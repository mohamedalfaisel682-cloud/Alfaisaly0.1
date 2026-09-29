import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

dotenv.config();


const __dirname = process.cwd();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'backup_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true 
    }
  }) as any);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // API Routes
  app.get('/api/auth/google/url', (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    res.json({ url });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      // Store tokens in session
      (req.session as any).tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>تم الربط بنجاح. سيتم إغلاق هذه النافذة تلقائياً.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth error:', error);
      res.status(500).send('فشل في عملية الربط.');
    }
  });

  app.get('/api/auth/status', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.json({ connected: false });
    }
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      res.json({ connected: true, email: userInfo.data.email });
    } catch (error) {
      res.json({ connected: false });
    }
  });

  app.post('/api/backup/drive', async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      return res.status(401).json({ error: 'غير متصل بحساب جوجل' });
    }

    const { data, filename } = req.body;
    try {
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const fileMetadata = {
        name: filename || `backup_${new Date().toISOString()}.json`,
        parents: [] // Can specify a folder ID here
      };

      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(data)
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      });

      res.json({ success: true, fileId: response.data.id });
    } catch (error) {
      console.error('Drive upload error:', error);
      res.status(500).json({ error: 'فشل في رفع النسخة الاحتياطية' });
    }
  });

  // Assistant Chat Route with Gemini Function Calling
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { prompt, mode } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'مفتاح GEMINI_API_KEY غير متوفر في البيئة' });
      }
      const aiInstance = new GoogleGenAI({ apiKey });
      const availableModels = ['gemini-3.6-flash', 'gemini-3.8-flash'];
      let modelToUse = 'gemini-3.6-flash';
      
      const isProfessional = mode !== 'detailed';
      const systemPrompt = isProfessional
        ? `أنت (مساعد الفيصل المحترف) - الخبير الصوتي والذكاء الاصطناعي لنظام "الفيصل للصيانة".
تمتاز بالقدرة العالية جداً على فهم مقصود وسياق المستخدم مهما اختلف ترتيب الكلمات، أو طال النص أو قصر، أو تم ذكر أسماء العملاء بشكل جزئي أو مختصر بدون التقيد بنص محدد للأوامر.
أمثلة جليّة للفهم المرن والمرونة العالية:
- إذا قال المستخدم "اضف دفعة حساب للمهمة الاخيرة للعميل فلان" أو "اضف مبلغ لفلان" أو "سجل 5000 بحساب المهمة الأخيرة لأحمد"، استدعِ addDeposit مع customerName المذكور (أو الجزئي) و amount والمؤشر isLastTask=true.
- إذا طلب تصفية أو فتح أو تعديل أو استعلام بأي جملة عامية أو عامة، استخرج الأسماء والأرقام والعمليات بدقة واستدعِ الدالة المناسبة فوراً.
نمطك الحالي هو [المساعد المحترف]: تتميز بالسرعة القصوى، والإجابة المباشرة الموجزة، والتنفيذ الفوري دون مقدمات أو حشو.
القواعد الصارمة لإجابتك:
1. إجابة مباشرة وحاسمة: قدم الرقم، أو المعلومة، أو نتيجة الإجراء فوراً وبأقصر عبارة مفيدة بدون أي ترحيب، مجاملة، أو ديباجات.
2. اكتب باللغة العربية الفصيحة الصافية وبدون أي حركات تشكيل لضمان نطقها بسلاسة تامة.`
        : `أنت المساعد الذكي والخبير الشامل لتطبيق (الفيصل للصيانة).
تفهم القصد الحقيقي والضمني للمستخدم مهما اختلف ترتيب الكلمات في الجملة أو تنوعت الصيغ والأساليب بدون التقيد بنص ثابت.
تعتمد على سياق البيانات المحفوظة محلياً (المهام، العملاء، الحسابات النقدية والخزائن، المركز المالي، المخزون، والديون).
اكتب باللغة العربية الفصيحة الصافية وبدون حركات تشكيل لضمان جودة النطق بمحرك الهاتف.`;

      const toolsList = [{
  functionDeclarations: [
    { name: "searchQuery", description: "البحث في التطبيق عبر شريط البحث السريع", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "النص المراد البحث عنه" } }, required: ["query"] } },
    { name: "addTask", description: "أضف مهمة صيانة جديدة.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, deviceType: { type: Type.STRING }, brand: { type: Type.STRING }, issue: { type: Type.STRING }, cost: { type: Type.NUMBER } }, required: ["customerName", "deviceType", "issue"] } },
    { name: "updateTaskStatus", description: "تحديث حالة مهمة صيانة موجودة.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, customerName: { type: Type.STRING }, status: { type: Type.STRING } }, required: ["status"] } },
    { name: "deleteTask", description: "حذف مهمة صيانة نهائياً.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER } }, required: ["taskId"] } },
    { name: "updateTaskCost", description: "تحديث أو تعديل التكلفة التقديرية لمهمة.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, customerName: { type: Type.STRING }, cost: { type: Type.NUMBER } }, required: ["cost"] } },
    { name: "openCustomerTask", description: "البحث عن مهام عميل معين لفتح إحداها. مفيد إذا طلب المستخدم فتح أو إظهار أو التعديل على جهاز العميل. يمكنك تحديد رقم المهمة في choice إذا طلبها صراحة.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, choice: { type: Type.STRING, description: "اختياري: الترتيب أو الرقم مثل 1 أو 'الأولى' أو 'الأخيرة'" } }, required: ["customerName"] } },
    { name: "addCustomer", description: "إضافة عميل جديد.", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, phone: { type: Type.STRING } }, required: ["name"] } },
    { name: "addDeposit", description: "إضافة دفعة حساب أو مبلغ مقدم لمهمة صيانة أو لعميل معين (مثال: اضف دفعة حساب للمهمة الاخيرة للعميل فلان، أو اضف مبلغ لفلان).", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER, description: "رقم المهمة الاختياري إذا عرف الرقم" }, customerName: { type: Type.STRING, description: "اسم العميل كامل أو جزئي (مثل: أحمد، فلان، الفايصل)" }, amount: { type: Type.NUMBER, description: "المبلغ المراد إضافته" }, isLastTask: { type: Type.BOOLEAN, description: "تكون true إذا أشار المستخدم للمهمة الأخيرة للعميل" } }, required: ["amount"] } },
    { name: "addDeviceModel", description: "إضافة موديل جديد لنوع جهاز.", parameters: { type: Type.OBJECT, properties: { deviceType: { type: Type.STRING }, brand: { type: Type.STRING }, modelName: { type: Type.STRING } }, required: ["deviceType", "modelName"] } },
    { name: "openTab", description: "الانتقال إلى قسم أو شاشة محددة في التطبيق.", parameters: { type: Type.OBJECT, properties: { tabId: { type: Type.STRING, description: "القسم: tasks, customers, inventory, accounting, reports, settings, notes" }, filterQuery: { type: Type.STRING } }, required: ["tabId"] } },
    { name: "setTaskReminder", description: "ضبط تنبيه.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, amount: { type: Type.NUMBER }, unit: { type: Type.STRING } }, required: ["amount", "unit"] } },
    { name: "addNote", description: "إنشاء ملاحظة جديدة.", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING }, taskId: { type: Type.NUMBER }, reminderAmount: { type: Type.NUMBER }, reminderUnit: { type: Type.STRING } }, required: ["title"] } },
    { name: "undoAction", description: "التراجع أو الاستعادة عن الإجراء الأخير (كإضافة عميل، إضافة مهمة، تعديل، ملاحظة)", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "shareToWhatsApp", description: "مشاركة تفاصيل المهمة عبر الواتساب.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, target: { type: Type.STRING, description: "جهة المشاركة customer أو faisali" } }, required: ["taskId"] } },
    { name: "countTasks", description: "معرفة عدد المهام الكلية، المعلقة وقيد التنفيذ.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getFinancialSummary", description: "معرفة ملخص مالي للحسابات وإيرادات ومصروفات وأرباح اليوم والنشاط العام.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getReadyTasksSummary", description: "معرفة واستخراج الأجهزة والمهام الجاهزة للتسليم حالياً وأسماء أصحابها وتفاصيلها.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getDailySummary", description: "استخراج ملخص وتقرير أعمال اليوم الشاملة بدقة وسرعة.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getBoxBalance", description: "معرفة رصيد الخزينة والصندوق المتاح حالياً بالريال اليمني.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getDebtsSummary", description: "معرفة إجمالي ديون ومستحقات العملاء المتبقية على مهام الصيانة.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getFinancialCenterDetails", description: "معرفة تفاصيل ومؤشرات المركز المالي، إجمالي الأصول الرأسمالية، صافي رأس المال، السيولة، قيمة المخزون، ديون العملاء والالتزامات.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "listCashAccounts", description: "عرض كافة الحسابات النقدية والخزائن والصناديق وأرصدتها الحالية.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "listDebts", description: "عرض الديون والالتزامات القائمة للموردين والممولين والمبالغ المتبقية.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "getInventorySummary", description: "معرفة إحصائيات قطع الغيار والمخزون والأصناف المتاحة والمنخفضة.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "updateTaskDetails", description: "تعديل تفاصيل مهمة صيانة كالعطل أو الجهاز أو التكلفة أو الملاحظات.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER }, issue: { type: Type.STRING }, deviceType: { type: Type.STRING }, brand: { type: Type.STRING }, cost: { type: Type.NUMBER } }, required: ["taskId"] } },
    { name: "updateCustomer", description: "تعديل بيانات عميل موجود كهاتفه أو تصنيفه أو اسمه.", parameters: { type: Type.OBJECT, properties: { customerId: { type: Type.NUMBER }, name: { type: Type.STRING }, phone: { type: Type.STRING }, classification: { type: Type.STRING } }, required: ["name"] } },
    { name: "addInventoryItem", description: "إضافة صنف أو قطعة غيار جديدة للمخزون.", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, category: { type: Type.STRING }, sellingPrice: { type: Type.NUMBER }, costPrice: { type: Type.NUMBER }, stock: { type: Type.NUMBER } }, required: ["name"] } },
    { name: "updateInventoryItem", description: "تعديل كمية أو سعر صنف في المخزون.", parameters: { type: Type.OBJECT, properties: { itemId: { type: Type.NUMBER }, name: { type: Type.STRING }, stock: { type: Type.NUMBER }, sellingPrice: { type: Type.NUMBER } } } },
    { name: "deleteInventoryItem", description: "حذف صنف من المخزون.", parameters: { type: Type.OBJECT, properties: { itemId: { type: Type.NUMBER }, name: { type: Type.STRING } } } },
    { name: "deleteCustomer", description: "حذف عميل من النظام.", parameters: { type: Type.OBJECT, properties: { customerId: { type: Type.NUMBER }, name: { type: Type.STRING } } } },
    { name: "addFinancialTransaction", description: "تسجيل حركة مالية جديدة (إيراد، قبض، مصروف، أو صرف).", parameters: { type: Type.OBJECT, properties: { type: { type: Type.STRING, description: "income أو expense" }, amount: { type: Type.NUMBER }, description: { type: Type.STRING }, category: { type: Type.STRING } }, required: ["type", "amount", "description"] } },
    { name: "addDebtAccount", description: "تسجيل دين أو التزام جديد لمورد أو ممول.", parameters: { type: Type.OBJECT, properties: { creditorName: { type: Type.STRING }, totalAmount: { type: Type.NUMBER }, purpose: { type: Type.STRING }, currency: { type: Type.STRING } }, required: ["creditorName", "totalAmount"] } },
    { name: "payDebt", description: "سداد جزء أو كامل دين مورد.", parameters: { type: Type.OBJECT, properties: { creditorName: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ["creditorName", "amount"] } },
    { name: "openWindow", description: "فتح أو إغلاق أي نافذة أو نموذج بالصوت دون لمس الشاشة (مثل: newTask, newCustomer, newInventory, accounts, debts, flashSettings, voiceSettings, backup, quickNotes, closeModals).", parameters: { type: Type.OBJECT, properties: { windowName: { type: Type.STRING, description: "اسم النافذة: newTask, newCustomer, newInventory, accounts, debts, flashSettings, voiceSettings, backup, quickNotes, closeModals" } }, required: ["windowName"] } },
    { name: "toggleSetting", description: "تفعيل أو إلغاء تفعيل أي خيار أو ميزة في النظام بالصوت دون لمس الشاشة (مثل: flashTicker للشريط الفلاشي، darkMode للوضع الليلي، voiceSpeech للنطق الصوتي، assistantIcon لأيقونة المساعد).", parameters: { type: Type.OBJECT, properties: { setting: { type: Type.STRING, description: "اسم الإعداد: flashTicker أو darkMode أو voiceSpeech أو assistantIcon" }, enable: { type: Type.BOOLEAN, description: "true للتفعيل والتشغيل، false لإلغاء التفعيل والإيقاف" } }, required: ["setting", "enable"] } },
    { name: "setFlashTaskRange", description: "تغيير نطاق عرض مهام الواجهة الفلاشية (1day لليوم القادم، 2days ليومين، 3days لثلاثة، 4days لأربعة، 1week لأسبوع، 1month لشهر).", parameters: { type: Type.OBJECT, properties: { range: { type: Type.STRING, description: "النطاق: 1day, 2days, 3days, 4days, 1week, 1month" } }, required: ["range"] } },
    { name: "filterTasks", description: "فلترة وتصفية عرض قائمة المهام بحسب الحالة (معلقة، قيد التنفيذ، جاهزة، مسلمة، ملغية، الكل).", parameters: { type: Type.OBJECT, properties: { status: { type: Type.STRING } }, required: ["status"] } },
    { name: "addCashAccount", description: "إضافة حساب نقدي أو خزينة أو صندوق جديد في الحسابات.", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING, description: "cashbox أو vault أو bank أو wallet" }, balance: { type: Type.NUMBER }, currency: { type: Type.STRING } }, required: ["name"] } },
    { name: "getTaskDetails", description: "معرفة تفاصيل أو حالة مهمة صيانة معينة بناءً على رقمها.", parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.NUMBER } }, required: ["taskId"] } },
    { name: "listCustomers", description: "سرد العملاء البارزين أو معرفة عددهم.", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "triggerDriveBackup", description: "فتح نافذة أو تفعيل أخذ نسخة احتياطية (باك اب).", parameters: { type: Type.OBJECT, properties: {} } },
    { name: "addDropdownOption", description: "إضافة خيار جديد لإحدى القوائم المنسدلة في نافذة المهمة (مثل خيارات المشكلة، الفحص، الحالة، موقع الحفظ، الفنيين، أو الأصناف).", parameters: { type: Type.OBJECT, properties: { listName: { type: Type.STRING, description: "اسم القائمة: issueOptions أو inspectionOptions أو statusOptions أو storageLocations أو technicianOptions أو inventoryCategoryOptions" }, optionValue: { type: Type.STRING, description: "نص الخيار الجديد المراد إضافته للقائمة" } }, required: ["listName", "optionValue"] } },
    { name: "addCustomerPhone", description: "إضافة أو تحديث رقم هاتف لعميل.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, phone: { type: Type.STRING } }, required: ["customerName", "phone"] } },
    { name: "updateCustomerTaskStatus", description: "تحديث وتغيير حالة مهمة العميل مباشرة باسم العميل بالحالة الجديدة.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING }, status: { type: Type.STRING } }, required: ["customerName", "status"] } },
    { name: "exportTaskOrAccountDocument", description: "إخراج أو طباعة مستند أو صورة إيصال لمهمة صيانة أو تقرير كشف حساب لعميل/حساب.", parameters: { type: Type.OBJECT, properties: { targetType: { type: Type.STRING, description: "نوع المستند: task أو account" }, identifier: { type: Type.STRING, description: "رقم المهمة أو اسم العميل/الحساب" } }, required: ["targetType", "identifier"] } },
    { name: "getCustomerData", description: "استخراج جميع البيانات والمدخلات والمهام والهواتف والحسابات الخاصة بعميل معين.", parameters: { type: Type.OBJECT, properties: { customerName: { type: Type.STRING } }, required: ["customerName"] } },
    { name: "getInventoryItemData", description: "استخراج تفاصيل مدخلات وبيانات صنف معين في المستودع والمخزون.", parameters: { type: Type.OBJECT, properties: { itemName: { type: Type.STRING } }, required: ["itemName"] } }
  ]
}];

      let geminiRes: any = null;
      for (const m of availableModels) {
        try {
          geminiRes = await aiInstance.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              systemInstruction: systemPrompt,
              tools: toolsList
            }
          });
          modelToUse = m;
          break;
        } catch (mErr) {
          console.warn(`Model ${m} failed in assistant chat, trying next:`, mErr);
        }
      }

      if (!geminiRes) {
        return res.status(500).json({ error: 'لم يكتمل الاتصال بنموذج جيميني' });
      }

      const responseText = geminiRes.text || '';
      const functionCalls = geminiRes.functionCalls || [];

      res.json({
        responseText,
        functionCalls,
        modelUsed: modelToUse
      });
    } catch (error: any) {
      console.error('Assistant chat error:', error);
      res.status(500).json({ error: error.message || 'خطأ في معالجة طلب المساعد' });
    }
  });

  // Voice Audio Transcription with Gemini (Arabic speech-to-text fallback)
  app.post('/api/assistant/transcribe', async (req, res) => {
    try {
      const { audioData, mimeType, isNumeric } = req.body;
      if (!audioData) {
        return res.status(400).json({ error: 'audioData is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: 'مفتاح GEMINI_API_KEY غير متوفر' });
      }

      const aiInstance = new GoogleGenAI({ apiKey });
      const availableModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
      let transcript = '';

      const promptText = isNumeric
        ? 'أنت محول صوتي فائق الدقة ومحول أرقام مالي. حوّل هذا المقطع الصوتي العربي بدقة إلى رقم حسابي فقط بالأرقام الإنجليزية (مثل: 5000 أو 250 أو 15.5) بدون أي كلمات أو عملات أو نصوص إضافية أو علامات تنصيص. إذا لم يكن هناك رقم أو كلام واضح، أعد نصاً فارغاً.'
        : 'أنت محول صوتي فائق الدقة. حوّل هذا المقطع الصوتي العربي بدقة إلى نص مكتوب فقط بدون أي مقدمات أو تعليقات أو شروحات إضافية أو علامات تنصيص. إذا لم يكن هناك كلام واضح، أعد نصاً فارغاً.';

      for (const m of availableModels) {
        try {
          const geminiRes = await aiInstance.models.generateContent({
            model: m,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: audioData
                    }
                  },
                  {
                    text: promptText
                  }
                ]
              }
            ]
          });
          transcript = geminiRes.text?.trim() || '';
          if (transcript) break;
        } catch (err) {
          console.warn(`Model ${m} failed for audio transcription, trying next:`, err);
        }
      }

      res.json({ transcript });
    } catch (error: any) {
      console.error('Audio transcription error:', error);
      res.status(500).json({ error: error.message || 'فشل في تحويل الصوت إلى نص' });
    }
  });

  // Arabic Audio Speech Generation (TTS) Route - Works across Web, Android 13 APK, and Capacitor
  app.get('/api/assistant/tts', async (req, res) => {
    try {
      const text = ((req.query.text as string) || '').trim();
      if (!text) {
        return res.status(400).send('Text parameter is required');
      }

      // Clean text for speech synthesis: remove emojis, special symbols, markdown
      const clean = text
        .replace(/[\*#_`~]/g, '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
        .trim();

      if (!clean) {
        return res.status(400).send('No valid text to speak');
      }

      // Truncate to safe length for single utterance (max 280 chars for smooth speech chunk)
      const spokenChunk = clean.slice(0, 280);

      // Fetch natural Arabic audio stream from high-fidelity TTS (client=gtx generates rich Arabic MP3 audio)
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=gtx&q=${encodeURIComponent(spokenChunk)}`;
      const audioRes = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-N986B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
        }
      });

      if (!audioRes.ok) {
        return res.status(audioRes.status).send('TTS fetch failed');
      }

      const buffer = Buffer.from(await audioRes.arrayBuffer());
      if (buffer.length < 100) {
        return res.status(502).send('Received empty audio payload');
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (err: any) {
      console.error('TTS endpoint error:', err);
      res.status(500).send(err.message || 'TTS failed');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  let ai: GoogleGenAI | null = null;
  try {
    if (process.env.GEMINI_API_KEY) {
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs) => {
    if (!ai) {
      console.error("Gemini API key is missing. Connection rejected.");
      clientWs.close();
      return;
    }
    
    try {
      const session = await ai.live.connect({
        model: "gemini-2.5-flash",
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.toolCall) {
              clientWs.send(JSON.stringify({ toolCall: message.toolCall }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: {
            parts: [{ text: "أنت المساعد الذكي الخبير لتطبيق (الفيصل للصيانة) وتعمل بمحرك جيميناي (Gemini). لديك اطلاع كامل على بيانات النظام وإمكانية التراجع أو الاستعادة عبر استدعاء (undoAction). استخدم وعيك للتعلم من البيانات، ونفذ الأدوات بدقة واحترافية عالية." }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "searchQuery",
                description: "البحث في التطبيق عبر شريط البحث السريع",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "النص المراد البحث عنه" }
                  },
                  required: ["query"]
                }
              },

              {
                name: "addTask",
                description: "أضف مهمة صيانة جديدة.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING, description: "اسم العميل" },
                    deviceType: { type: Type.STRING, description: "نوع الجهاز (مثل: لابتوب، هاتف)" },
                    brand: { type: Type.STRING, description: "الماركة (مثل: سامسونج، ديل)" },
                    issue: { type: Type.STRING, description: "وصف العطل" },
                    cost: { type: Type.NUMBER, description: "التكلفة التقديرية" }
                  },
                  required: ["customerName", "deviceType", "issue"]
                }
              },
              {
                name: "updateTaskStatus",
                description: "تحديث حالة مهمة صيانة موجودة.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.NUMBER, description: "رقم المهمة (ID)" },
                    status: { type: Type.STRING, description: "الحالة الجديدة (مثل: جاهز للتسليم، تم التسليم، قيد الفحص، ملغي)" }
                  },
                  required: ["taskId", "status"]
                }
              },
              {
                name: "updateSetting",
                description: "تغيير إعدادات التطبيق أو المظهر.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    settingKey: { type: Type.STRING, description: "اسم الإعداد (مثل: dark_mode, primary_color)" },
                    settingValue: { type: Type.STRING, description: "القيمة الجديدة للإعداد" }
                  },
                  required: ["settingKey", "settingValue"]
                }
              },
              {
                name: "addCustomer",
                description: "إضافة عميل جديد مع رقم الهاتف.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "اسم العميل" },
                    phone: { type: Type.STRING, description: "رقم جوال العميل" }
                  },
                  required: ["name"]
                }
              },
              {
                name: "addDeviceModel",
                description: "إضافة موديل لنوع جهاز معين.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    deviceType: { type: Type.STRING, description: "نوع الجهاز" },
                    brand: { type: Type.STRING, description: "الماركة" },
                    modelName: { type: Type.STRING, description: "اسم الموديل الجديد" }
                  },
                  required: ["deviceType", "modelName"]
                }
              },
              {
                name: "shareToWhatsApp",
                description: "نسخ ومشاركة تفاصيل المهمة للواتساب أو لرقم العميل/رقم الفيصلي.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.NUMBER, description: "رقم المهمة (ID) المراد مشاركتها" },
                    target: { type: Type.STRING, description: "الهدف للمشاركة (customer أو faisali)" }
                  },
                  required: ["taskId"]
                }
              },
              {
                name: "addDeposit",
                description: "إضافة دفعة مقدم لمهمة صيانة.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.NUMBER, description: "رقم المهمة (ID)" },
                    amount: { type: Type.NUMBER, description: "مبلغ الدفعة المقدمة" }
                  },
                  required: ["taskId", "amount"]
                }
              }
            ]
          }]
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (msg.toolResponse) {
             session.sendToolResponse({
               functionResponses: msg.toolResponse
             });
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      });
      
      clientWs.on("close", () => {
        // session.close() is not available or handled via garbage collection
      });
    } catch (err) {
      console.error("Error setting up live api:", err);
    }
  });
}

startServer();