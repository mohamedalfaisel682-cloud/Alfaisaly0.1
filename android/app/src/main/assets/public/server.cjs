var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var import_path = __toESM(require("path"), 1);
var import_googleapis = require("googleapis");
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_express_session = __toESM(require("express-session"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_ws = require("ws");
var import_genai = require("@google/genai");
import_dotenv.default.config();
var __dirname = process.cwd();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use((0, import_cookie_parser.default)());
  app.use((0, import_express_session.default)({
    secret: process.env.SESSION_SECRET || "backup_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true
    }
  }));
  const oauth2Client = new import_googleapis.google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  app.get("/api/auth/google/url", (req, res) => {
    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent"
    });
    res.json({ url });
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code);
      req.session.tokens = tokens;
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
            <p>\u062A\u0645 \u0627\u0644\u0631\u0628\u0637 \u0628\u0646\u062C\u0627\u062D. \u0633\u064A\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0647\u0630\u0647 \u0627\u0644\u0646\u0627\u0641\u0630\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth error:", error);
      res.status(500).send("\u0641\u0634\u0644 \u0641\u064A \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0631\u0628\u0637.");
    }
  });
  app.get("/api/auth/status", async (req, res) => {
    const tokens = req.session.tokens;
    if (!tokens) {
      return res.json({ connected: false });
    }
    try {
      oauth2Client.setCredentials(tokens);
      const oauth2 = import_googleapis.google.oauth2({ auth: oauth2Client, version: "v2" });
      const userInfo = await oauth2.userinfo.get();
      res.json({ connected: true, email: userInfo.data.email });
    } catch (error) {
      res.json({ connected: false });
    }
  });
  app.post("/api/backup/drive", async (req, res) => {
    const tokens = req.session.tokens;
    if (!tokens) {
      return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644 \u0628\u062D\u0633\u0627\u0628 \u062C\u0648\u062C\u0644" });
    }
    const { data, filename } = req.body;
    try {
      oauth2Client.setCredentials(tokens);
      const drive = import_googleapis.google.drive({ version: "v3", auth: oauth2Client });
      const fileMetadata = {
        name: filename || `backup_${(/* @__PURE__ */ new Date()).toISOString()}.json`,
        parents: []
        // Can specify a folder ID here
      };
      const media = {
        mimeType: "application/json",
        body: JSON.stringify(data)
      };
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: "id"
      });
      res.json({ success: true, fileId: response.data.id });
    } catch (error) {
      console.error("Drive upload error:", error);
      res.status(500).json({ error: "\u0641\u0634\u0644 \u0641\u064A \u0631\u0641\u0639 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629" });
    }
  });
  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const { prompt, mode } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 \u0641\u064A \u0627\u0644\u0628\u064A\u0626\u0629" });
      }
      const aiInstance = new import_genai.GoogleGenAI({ apiKey });
      const availableModels = ["gemini-3.6-flash", "gemini-3.8-flash"];
      let modelToUse = "gemini-3.6-flash";
      const isProfessional = mode !== "detailed";
      const systemPrompt = isProfessional ? `\u0623\u0646\u062A (\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0641\u064A\u0635\u0644 \u0627\u0644\u0645\u062D\u062A\u0631\u0641) - \u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0635\u0648\u062A\u064A \u0648\u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0644\u0646\u0638\u0627\u0645 "\u0627\u0644\u0641\u064A\u0635\u0644 \u0644\u0644\u0635\u064A\u0627\u0646\u0629".
\u0646\u0645\u0637\u0643 \u0627\u0644\u062D\u0627\u0644\u064A \u0647\u0648 [\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0645\u062D\u062A\u0631\u0641]: \u064A\u062A\u0645\u064A\u0632 \u0628\u0627\u0644\u0633\u0631\u0639\u0629 \u0627\u0644\u0642\u0635\u0648\u0649\u060C \u0648\u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629 \u0627\u0644\u0645\u0648\u062C\u0632\u0629\u060C \u0648\u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0641\u0648\u0631\u064A \u062F\u0648\u0646 \u0645\u0642\u062F\u0645\u0627\u062A \u0623\u0648 \u062D\u0634\u0648.
\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0635\u0627\u0631\u0645\u0629 \u0644\u0625\u062C\u0627\u0628\u062A\u0643:
1. \u0625\u062C\u0627\u0628\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0648\u062D\u0627\u0633\u0645\u0629: \u0642\u062F\u0645 \u0627\u0644\u0631\u0642\u0645\u060C \u0623\u0648 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0629\u060C \u0623\u0648 \u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0641\u0648\u0631\u0627\u064B \u0648\u0628\u0623\u0642\u0635\u0631 \u0639\u0628\u0627\u0631\u0629 \u0645\u0641\u064A\u062F\u0629 \u0628\u062F\u0648\u0646 \u0623\u064A \u062A\u0631\u062D\u064A\u0628\u060C \u0645\u062C\u0627\u0645\u0644\u0629\u060C \u0623\u0648 \u062F\u064A\u0628\u0627\u062C\u0627\u062A (\u0645\u062B\u0627\u0644: \u0642\u0644 \u0641\u0648\u0631\u0627\u064B "\u0631\u0635\u064A\u062F \u0627\u0644\u0635\u0646\u062F\u0648\u0642 180,000 \u0631\u064A\u0627\u0644"\u060C "\u0644\u062F\u064A\u0643 3 \u0623\u062C\u0647\u0632\u0629 \u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u0633\u0644\u064A\u0645"\u060C "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062F\u064A\u0648\u0646 \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 45,000 \u0631\u064A\u0627\u0644").
2. \u0631\u0628\u0637 \u0639\u0645\u064A\u0642 \u0648\u0645\u0628\u0627\u0634\u0631 \u0628\u0627\u0644\u0627\u062E\u062A\u0635\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A:
   - "\u0645\u0644\u062E\u0635 \u0627\u0644\u064A\u0648\u0645" \u0623\u0648 "\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u064A\u0648\u0645" \u0623\u0648 "\u062F\u062E\u0644 \u0627\u0644\u064A\u0648\u0645": \u0627\u0633\u062A\u062F\u0639\u0650 getFinancialSummary \u0623\u0648 getDailySummary.
   - "\u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062C\u0627\u0647\u0632\u0629" \u0623\u0648 "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062C\u0627\u0647\u0632\u0629": \u0627\u0633\u062A\u062F\u0639\u0650 getReadyTasksSummary.
   - "\u062F\u064A\u0648\u0646 \u0627\u0644\u0639\u0645\u0644\u0627\u0621" \u0623\u0648 "\u0627\u0644\u062F\u064A\u0648\u0646 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0629": \u0627\u0633\u062A\u062F\u0639\u0650 getDebtsSummary.
   - "\u0643\u0645 \u0641\u064A \u0627\u0644\u0635\u0646\u062F\u0648\u0642" \u0623\u0648 "\u0631\u0635\u064A\u062F \u0627\u0644\u062E\u0632\u064A\u0646\u0629": \u0627\u0633\u062A\u062F\u0639\u0650 getBoxBalance.
   - "\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A" \u0623\u0648 "\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644": \u0627\u0633\u062A\u062F\u0639\u0650 getFinancialCenterDetails.
   - "\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0646\u0642\u062F\u064A\u0629" \u0623\u0648 "\u0627\u0644\u062E\u0632\u0627\u0626\u0646": \u0627\u0633\u062A\u062F\u0639\u0650 listCashAccounts.
   - "\u0627\u0644\u0645\u062E\u0632\u0648\u0646" \u0623\u0648 "\u0642\u0637\u0639 \u0627\u0644\u063A\u064A\u0627\u0631": \u0627\u0633\u062A\u062F\u0639\u0650 getInventorySummary.
   - "\u062A\u0631\u0627\u062C\u0639": \u0627\u0633\u062A\u062F\u0639\u0650 undoAction \u0641\u0648\u0631\u0627\u064B.
3. \u0627\u0633\u062A\u062F\u0639\u0650 \u0627\u0644\u062F\u0648\u0627\u0644 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0641\u0648\u0631\u0627\u064B \u0644\u0644\u0639\u0645\u0644\u064A\u0627\u062A (\u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0645\u0629\u060C \u062A\u0639\u062F\u064A\u0644\u060C \u062A\u0633\u0644\u064A\u0645\u060C \u062F\u0641\u0639\u0629\u060C \u0641\u062A\u062D \u0634\u0627\u0634\u0629).
4. \u0627\u0643\u062A\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u064A\u062D\u0629 \u0627\u0644\u0635\u0627\u0641\u064A\u0629 \u0648\u0628\u062F\u0648\u0646 \u0623\u064A \u062D\u0631\u0643\u0627\u062A \u062A\u0634\u0643\u064A\u0644 (\u0628\u062F\u0648\u0646 \u0641\u062A\u062D\u0627\u062A\u060C \u0636\u0645\u0645\u060C \u0643\u0633\u0631\u0627\u062A\u060C \u0633\u0643\u0648\u0646\u060C \u0623\u0648 \u062A\u0646\u0648\u064A\u0646) \u062D\u062A\u0649 \u064A\u0646\u0637\u0642\u0647\u0627 \u0645\u062D\u0631\u0643 \u0627\u0644\u0647\u0627\u062A\u0641 \u0628\u0633\u0644\u0627\u0633\u0629 \u062A\u0627\u0645\u0629.
5. \u0627\u062E\u062A\u0635\u0627\u0635\u0643 \u0645\u062D\u0635\u0648\u0631 \u062F\u0627\u062E\u0644\u064A\u0627\u064B \u0641\u064A \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0641\u064A\u0635\u0644 \u0644\u0644\u0635\u064A\u0627\u0646\u0629 \u0641\u0642\u0637.` : `\u0623\u0646\u062A \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0648\u0627\u0644\u062E\u0628\u064A\u0631 \u0627\u0644\u0634\u0627\u0645\u0644 \u0644\u062A\u0637\u0628\u064A\u0642 (\u0627\u0644\u0641\u064A\u0635\u0644 \u0644\u0644\u0635\u064A\u0627\u0646\u0629).
\u0646\u0645\u0637\u0643 \u0627\u0644\u062D\u0627\u0644\u064A \u0647\u0648 [\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0645\u0641\u0635\u0644]: \u062A\u0642\u062F\u0645 \u0634\u0631\u0648\u062D\u0627\u062A \u0648\u0627\u0641\u064A\u0629\u060C \u0648\u062A\u0648\u0636\u064A\u062D\u0627\u064B \u0644\u062E\u0637\u0648\u0627\u062A \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0646\u062F\u0629.
\u0643\u0627\u0641\u0629 \u062A\u062D\u0644\u064A\u0644\u0627\u062A\u0643 \u0648\u0625\u062C\u0631\u0627\u0621\u0627\u062A\u0643 \u062A\u0639\u062A\u0645\u062F \u0628\u062F\u0642\u0629 \u0645\u062A\u0646\u0627\u0647\u064A\u0629 \u0639\u0644\u0649 \u0633\u064A\u0627\u0642 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u062D\u0641\u0648\u0638\u0629 \u0645\u062D\u0644\u064A\u0627\u064B (\u0627\u0644\u0645\u0647\u0627\u0645\u060C \u0627\u0644\u0639\u0645\u0644\u0627\u0621\u060C \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0648\u0627\u0644\u062E\u0632\u0627\u0626\u0646\u060C \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A\u060C \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A\u060C \u0648\u0627\u0644\u062F\u064A\u0648\u0646).
\u0627\u0643\u062A\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u064A\u062D\u0629 \u0627\u0644\u0635\u0627\u0641\u064A\u0629 \u0648\u0628\u062F\u0648\u0646 \u062D\u0631\u0643\u0627\u062A \u062A\u0634\u0643\u064A\u0644 \u0644\u0636\u0645\u0627\u0646 \u062C\u0648\u062F\u0629 \u0627\u0644\u0646\u0637\u0642 \u0628\u0645\u062D\u0631\u0643 \u0627\u0644\u0647\u0627\u062A\u0641.`;
      const toolsList = [{
        functionDeclarations: [
          { name: "searchQuery", description: "\u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0639\u0628\u0631 \u0634\u0631\u064A\u0637 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639", parameters: { type: import_genai.Type.OBJECT, properties: { query: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0644\u0628\u062D\u062B \u0639\u0646\u0647" } }, required: ["query"] } },
          { name: "addTask", description: "\u0623\u0636\u0641 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u062C\u062F\u064A\u062F\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { customerName: { type: import_genai.Type.STRING }, deviceType: { type: import_genai.Type.STRING }, brand: { type: import_genai.Type.STRING }, issue: { type: import_genai.Type.STRING }, cost: { type: import_genai.Type.NUMBER } }, required: ["customerName", "deviceType", "issue"] } },
          { name: "updateTaskStatus", description: "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0645\u0648\u062C\u0648\u062F\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, status: { type: import_genai.Type.STRING } }, required: ["taskId", "status"] } },
          { name: "deleteTask", description: "\u062D\u0630\u0641 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0646\u0647\u0627\u0626\u064A\u0627\u064B.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER } }, required: ["taskId"] } },
          { name: "updateTaskCost", description: "\u062A\u062D\u062F\u064A\u062B \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 \u0644\u0645\u0647\u0645\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, cost: { type: import_genai.Type.NUMBER } }, required: ["taskId", "cost"] } },
          { name: "openCustomerTask", description: "\u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0645\u0647\u0627\u0645 \u0639\u0645\u064A\u0644 \u0645\u0639\u064A\u0646 \u0644\u0641\u062A\u062D \u0625\u062D\u062F\u0627\u0647\u0627. \u0645\u0641\u064A\u062F \u0625\u0630\u0627 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u062A\u062D \u0623\u0648 \u0625\u0638\u0647\u0627\u0631 \u0623\u0648 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0639\u0644\u0649 \u062C\u0647\u0627\u0632 \u0627\u0644\u0639\u0645\u064A\u0644. \u064A\u0645\u0643\u0646\u0643 \u062A\u062D\u062F\u064A\u062F \u0631\u0642\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 \u0641\u064A choice \u0625\u0630\u0627 \u0637\u0644\u0628\u0647\u0627 \u0635\u0631\u0627\u062D\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { customerName: { type: import_genai.Type.STRING }, choice: { type: import_genai.Type.STRING, description: "\u0627\u062E\u062A\u064A\u0627\u0631\u064A: \u0627\u0644\u062A\u0631\u062A\u064A\u0628 \u0623\u0648 \u0627\u0644\u0631\u0642\u0645 \u0645\u062B\u0644 1 \u0623\u0648 '\u0627\u0644\u0623\u0648\u0644\u0649'" } }, required: ["customerName"] } },
          { name: "addCustomer", description: "\u0625\u0636\u0627\u0641\u0629 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F.", parameters: { type: import_genai.Type.OBJECT, properties: { name: { type: import_genai.Type.STRING }, phone: { type: import_genai.Type.STRING } }, required: ["name"] } },
          { name: "addDeposit", description: "\u0625\u0636\u0627\u0641\u0629 \u062F\u0641\u0639\u0629 \u0645\u0642\u062F\u0645 \u0644\u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, amount: { type: import_genai.Type.NUMBER } }, required: ["taskId", "amount"] } },
          { name: "addDeviceModel", description: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u062F\u064A\u0644 \u062C\u062F\u064A\u062F \u0644\u0646\u0648\u0639 \u062C\u0647\u0627\u0632.", parameters: { type: import_genai.Type.OBJECT, properties: { deviceType: { type: import_genai.Type.STRING }, brand: { type: import_genai.Type.STRING }, modelName: { type: import_genai.Type.STRING } }, required: ["deviceType", "modelName"] } },
          { name: "openTab", description: "\u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649 \u0642\u0633\u0645 \u0623\u0648 \u0634\u0627\u0634\u0629 \u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642.", parameters: { type: import_genai.Type.OBJECT, properties: { tabId: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0642\u0633\u0645: tasks, customers, inventory, accounting, reports, settings, notes" }, filterQuery: { type: import_genai.Type.STRING } }, required: ["tabId"] } },
          { name: "setTaskReminder", description: "\u0636\u0628\u0637 \u062A\u0646\u0628\u064A\u0647.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, amount: { type: import_genai.Type.NUMBER }, unit: { type: import_genai.Type.STRING } }, required: ["amount", "unit"] } },
          { name: "addNote", description: "\u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0627\u062D\u0638\u0629 \u062C\u062F\u064A\u062F\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: { title: { type: import_genai.Type.STRING }, content: { type: import_genai.Type.STRING }, taskId: { type: import_genai.Type.NUMBER }, reminderAmount: { type: import_genai.Type.NUMBER }, reminderUnit: { type: import_genai.Type.STRING } }, required: ["title"] } },
          { name: "undoAction", description: "\u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0623\u0648 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0639\u0646 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0623\u062E\u064A\u0631 (\u0643\u0625\u0636\u0627\u0641\u0629 \u0639\u0645\u064A\u0644\u060C \u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0645\u0629\u060C \u062A\u0639\u062F\u064A\u0644\u060C \u0645\u0644\u0627\u062D\u0638\u0629)", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "shareToWhatsApp", description: "\u0645\u0634\u0627\u0631\u0643\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0647\u0645\u0629 \u0639\u0628\u0631 \u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, target: { type: import_genai.Type.STRING, description: "\u062C\u0647\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 customer \u0623\u0648 faisali" } }, required: ["taskId"] } },
          { name: "countTasks", description: "\u0645\u0639\u0631\u0641\u0629 \u0639\u062F\u062F \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0643\u0644\u064A\u0629\u060C \u0627\u0644\u0645\u0639\u0644\u0642\u0629 \u0648\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getFinancialSummary", description: "\u0645\u0639\u0631\u0641\u0629 \u0645\u0644\u062E\u0635 \u0645\u0627\u0644\u064A \u0644\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0648\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0648\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0648\u0623\u0631\u0628\u0627\u062D \u0627\u0644\u064A\u0648\u0645 \u0648\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u0639\u0627\u0645.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getReadyTasksSummary", description: "\u0645\u0639\u0631\u0641\u0629 \u0648\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0648\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u062A\u0633\u0644\u064A\u0645 \u062D\u0627\u0644\u064A\u0627\u064B \u0648\u0623\u0633\u0645\u0627\u0621 \u0623\u0635\u062D\u0627\u0628\u0647\u0627 \u0648\u062A\u0641\u0627\u0635\u064A\u0644\u0647\u0627.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getDailySummary", description: "\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0645\u0644\u062E\u0635 \u0648\u062A\u0642\u0631\u064A\u0631 \u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0628\u062F\u0642\u0629 \u0648\u0633\u0631\u0639\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getBoxBalance", description: "\u0645\u0639\u0631\u0641\u0629 \u0631\u0635\u064A\u062F \u0627\u0644\u062E\u0632\u064A\u0646\u0629 \u0648\u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u064A\u0645\u0646\u064A.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getDebtsSummary", description: "\u0645\u0639\u0631\u0641\u0629 \u0625\u062C\u0645\u0627\u0644\u064A \u062F\u064A\u0648\u0646 \u0648\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 \u0639\u0644\u0649 \u0645\u0647\u0627\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getFinancialCenterDetails", description: "\u0645\u0639\u0631\u0641\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0645\u0627\u0644\u064A\u060C \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0631\u0623\u0633\u0645\u0627\u0644\u064A\u0629\u060C \u0635\u0627\u0641\u064A \u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644\u060C \u0627\u0644\u0633\u064A\u0648\u0644\u0629\u060C \u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u062F\u064A\u0648\u0646 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "listCashAccounts", description: "\u0639\u0631\u0636 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0646\u0642\u062F\u064A\u0629 \u0648\u0627\u0644\u062E\u0632\u0627\u0626\u0646 \u0648\u0627\u0644\u0635\u0646\u0627\u062F\u064A\u0642 \u0648\u0623\u0631\u0635\u062F\u062A\u0647\u0627 \u0627\u0644\u062D\u0627\u0644\u064A\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "listDebts", description: "\u0639\u0631\u0636 \u0627\u0644\u062F\u064A\u0648\u0646 \u0648\u0627\u0644\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0644\u0644\u0645\u0648\u0631\u062F\u064A\u0646 \u0648\u0627\u0644\u0645\u0645\u0648\u0644\u064A\u0646 \u0648\u0627\u0644\u0645\u0628\u0627\u0644\u063A \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "getInventorySummary", description: "\u0645\u0639\u0631\u0641\u0629 \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0642\u0637\u0639 \u0627\u0644\u063A\u064A\u0627\u0631 \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0648\u0627\u0644\u0645\u0646\u062E\u0641\u0636\u0629.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "updateTaskDetails", description: "\u062A\u0639\u062F\u064A\u0644 \u062A\u0641\u0627\u0635\u064A\u0644 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0643\u0627\u0644\u0639\u0637\u0644 \u0623\u0648 \u0627\u0644\u062C\u0647\u0627\u0632 \u0623\u0648 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0623\u0648 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER }, issue: { type: import_genai.Type.STRING }, deviceType: { type: import_genai.Type.STRING }, brand: { type: import_genai.Type.STRING }, cost: { type: import_genai.Type.NUMBER } }, required: ["taskId"] } },
          { name: "updateCustomer", description: "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0639\u0645\u064A\u0644 \u0645\u0648\u062C\u0648\u062F \u0643\u0647\u0627\u062A\u0641\u0647 \u0623\u0648 \u062A\u0635\u0646\u064A\u0641\u0647 \u0623\u0648 \u0627\u0633\u0645\u0647.", parameters: { type: import_genai.Type.OBJECT, properties: { customerId: { type: import_genai.Type.NUMBER }, name: { type: import_genai.Type.STRING }, phone: { type: import_genai.Type.STRING }, classification: { type: import_genai.Type.STRING } }, required: ["name"] } },
          { name: "addInventoryItem", description: "\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u0623\u0648 \u0642\u0637\u0639\u0629 \u063A\u064A\u0627\u0631 \u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0645\u062E\u0632\u0648\u0646.", parameters: { type: import_genai.Type.OBJECT, properties: { name: { type: import_genai.Type.STRING }, category: { type: import_genai.Type.STRING }, sellingPrice: { type: import_genai.Type.NUMBER }, costPrice: { type: import_genai.Type.NUMBER }, stock: { type: import_genai.Type.NUMBER } }, required: ["name"] } },
          { name: "updateInventoryItem", description: "\u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0629 \u0623\u0648 \u0633\u0639\u0631 \u0635\u0646\u0641 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646.", parameters: { type: import_genai.Type.OBJECT, properties: { itemId: { type: import_genai.Type.NUMBER }, name: { type: import_genai.Type.STRING }, stock: { type: import_genai.Type.NUMBER }, sellingPrice: { type: import_genai.Type.NUMBER } } } },
          { name: "deleteInventoryItem", description: "\u062D\u0630\u0641 \u0635\u0646\u0641 \u0645\u0646 \u0627\u0644\u0645\u062E\u0632\u0648\u0646.", parameters: { type: import_genai.Type.OBJECT, properties: { itemId: { type: import_genai.Type.NUMBER }, name: { type: import_genai.Type.STRING } } } },
          { name: "deleteCustomer", description: "\u062D\u0630\u0641 \u0639\u0645\u064A\u0644 \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645.", parameters: { type: import_genai.Type.OBJECT, properties: { customerId: { type: import_genai.Type.NUMBER }, name: { type: import_genai.Type.STRING } } } },
          { name: "addFinancialTransaction", description: "\u062A\u0633\u062C\u064A\u0644 \u062D\u0631\u0643\u0629 \u0645\u0627\u0644\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 (\u0625\u064A\u0631\u0627\u062F\u060C \u0642\u0628\u0636\u060C \u0645\u0635\u0631\u0648\u0641\u060C \u0623\u0648 \u0635\u0631\u0641).", parameters: { type: import_genai.Type.OBJECT, properties: { type: { type: import_genai.Type.STRING, description: "income \u0623\u0648 expense" }, amount: { type: import_genai.Type.NUMBER }, description: { type: import_genai.Type.STRING }, category: { type: import_genai.Type.STRING } }, required: ["type", "amount", "description"] } },
          { name: "addDebtAccount", description: "\u062A\u0633\u062C\u064A\u0644 \u062F\u064A\u0646 \u0623\u0648 \u0627\u0644\u062A\u0632\u0627\u0645 \u062C\u062F\u064A\u062F \u0644\u0645\u0648\u0631\u062F \u0623\u0648 \u0645\u0645\u0648\u0644.", parameters: { type: import_genai.Type.OBJECT, properties: { creditorName: { type: import_genai.Type.STRING }, totalAmount: { type: import_genai.Type.NUMBER }, purpose: { type: import_genai.Type.STRING }, currency: { type: import_genai.Type.STRING } }, required: ["creditorName", "totalAmount"] } },
          { name: "payDebt", description: "\u0633\u062F\u0627\u062F \u062C\u0632\u0621 \u0623\u0648 \u0643\u0627\u0645\u0644 \u062F\u064A\u0646 \u0645\u0648\u0631\u062F.", parameters: { type: import_genai.Type.OBJECT, properties: { creditorName: { type: import_genai.Type.STRING }, amount: { type: import_genai.Type.NUMBER } }, required: ["creditorName", "amount"] } },
          { name: "openWindow", description: "\u0641\u062A\u062D \u0623\u0648 \u0625\u063A\u0644\u0627\u0642 \u0623\u064A \u0646\u0627\u0641\u0630\u0629 \u0623\u0648 \u0646\u0645\u0648\u0630\u062C \u0628\u0627\u0644\u0635\u0648\u062A \u062F\u0648\u0646 \u0644\u0645\u0633 \u0627\u0644\u0634\u0627\u0634\u0629 (\u0645\u062B\u0644: newTask, newCustomer, newInventory, accounts, debts, flashSettings, voiceSettings, backup, quickNotes, closeModals).", parameters: { type: import_genai.Type.OBJECT, properties: { windowName: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0646\u0627\u0641\u0630\u0629: newTask, newCustomer, newInventory, accounts, debts, flashSettings, voiceSettings, backup, quickNotes, closeModals" } }, required: ["windowName"] } },
          { name: "toggleSetting", description: "\u062A\u0641\u0639\u064A\u0644 \u0623\u0648 \u0625\u0644\u063A\u0627\u0621 \u062A\u0641\u0639\u064A\u0644 \u0623\u064A \u062E\u064A\u0627\u0631 \u0623\u0648 \u0645\u064A\u0632\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0627\u0644\u0635\u0648\u062A \u062F\u0648\u0646 \u0644\u0645\u0633 \u0627\u0644\u0634\u0627\u0634\u0629 (\u0645\u062B\u0644: flashTicker \u0644\u0644\u0634\u0631\u064A\u0637 \u0627\u0644\u0641\u0644\u0627\u0634\u064A\u060C darkMode \u0644\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064A\u0644\u064A\u060C voiceSpeech \u0644\u0644\u0646\u0637\u0642 \u0627\u0644\u0635\u0648\u062A\u064A\u060C assistantIcon \u0644\u0623\u064A\u0642\u0648\u0646\u0629 \u0627\u0644\u0645\u0633\u0627\u0639\u062F).", parameters: { type: import_genai.Type.OBJECT, properties: { setting: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0625\u0639\u062F\u0627\u062F: flashTicker \u0623\u0648 darkMode \u0623\u0648 voiceSpeech \u0623\u0648 assistantIcon" }, enable: { type: import_genai.Type.BOOLEAN, description: "true \u0644\u0644\u062A\u0641\u0639\u064A\u0644 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644\u060C false \u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0648\u0627\u0644\u0625\u064A\u0642\u0627\u0641" } }, required: ["setting", "enable"] } },
          { name: "setFlashTaskRange", description: "\u062A\u063A\u064A\u064A\u0631 \u0646\u0637\u0627\u0642 \u0639\u0631\u0636 \u0645\u0647\u0627\u0645 \u0627\u0644\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0641\u0644\u0627\u0634\u064A\u0629 (1day \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u0642\u0627\u062F\u0645\u060C 2days \u0644\u064A\u0648\u0645\u064A\u0646\u060C 3days \u0644\u062B\u0644\u0627\u062B\u0629\u060C 4days \u0644\u0623\u0631\u0628\u0639\u0629\u060C 1week \u0644\u0623\u0633\u0628\u0648\u0639\u060C 1month \u0644\u0634\u0647\u0631).", parameters: { type: import_genai.Type.OBJECT, properties: { range: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0646\u0637\u0627\u0642: 1day, 2days, 3days, 4days, 1week, 1month" } }, required: ["range"] } },
          { name: "filterTasks", description: "\u0641\u0644\u062A\u0631\u0629 \u0648\u062A\u0635\u0641\u064A\u0629 \u0639\u0631\u0636 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645 \u0628\u062D\u0633\u0628 \u0627\u0644\u062D\u0627\u0644\u0629 (\u0645\u0639\u0644\u0642\u0629\u060C \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u060C \u062C\u0627\u0647\u0632\u0629\u060C \u0645\u0633\u0644\u0645\u0629\u060C \u0645\u0644\u063A\u064A\u0629\u060C \u0627\u0644\u0643\u0644).", parameters: { type: import_genai.Type.OBJECT, properties: { status: { type: import_genai.Type.STRING } }, required: ["status"] } },
          { name: "addCashAccount", description: "\u0625\u0636\u0627\u0641\u0629 \u062D\u0633\u0627\u0628 \u0646\u0642\u062F\u064A \u0623\u0648 \u062E\u0632\u064A\u0646\u0629 \u0623\u0648 \u0635\u0646\u062F\u0648\u0642 \u062C\u062F\u064A\u062F \u0641\u064A \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A.", parameters: { type: import_genai.Type.OBJECT, properties: { name: { type: import_genai.Type.STRING }, type: { type: import_genai.Type.STRING, description: "cashbox \u0623\u0648 vault \u0623\u0648 bank \u0623\u0648 wallet" }, balance: { type: import_genai.Type.NUMBER }, currency: { type: import_genai.Type.STRING } }, required: ["name"] } },
          { name: "getTaskDetails", description: "\u0645\u0639\u0631\u0641\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0623\u0648 \u062D\u0627\u0644\u0629 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0645\u0639\u064A\u0646\u0629 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0631\u0642\u0645\u0647\u0627.", parameters: { type: import_genai.Type.OBJECT, properties: { taskId: { type: import_genai.Type.NUMBER } }, required: ["taskId"] } },
          { name: "listCustomers", description: "\u0633\u0631\u062F \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0628\u0627\u0631\u0632\u064A\u0646 \u0623\u0648 \u0645\u0639\u0631\u0641\u0629 \u0639\u062F\u062F\u0647\u0645.", parameters: { type: import_genai.Type.OBJECT, properties: {} } },
          { name: "triggerDriveBackup", description: "\u0641\u062A\u062D \u0646\u0627\u0641\u0630\u0629 \u0623\u0648 \u062A\u0641\u0639\u064A\u0644 \u0623\u062E\u0630 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 (\u0628\u0627\u0643 \u0627\u0628).", parameters: { type: import_genai.Type.OBJECT, properties: {} } }
        ]
      }];
      let geminiRes = null;
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
        return res.status(500).json({ error: "\u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0646\u0645\u0648\u0630\u062C \u062C\u064A\u0645\u064A\u0646\u064A" });
      }
      const responseText = geminiRes.text || "";
      const functionCalls = geminiRes.functionCalls || [];
      res.json({
        responseText,
        functionCalls,
        modelUsed: modelToUse
      });
    } catch (error) {
      console.error("Assistant chat error:", error);
      res.status(500).json({ error: error.message || "\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062F" });
    }
  });
  app.post("/api/assistant/transcribe", async (req, res) => {
    try {
      const { audioData, mimeType, isNumeric } = req.body;
      if (!audioData) {
        return res.status(400).json({ error: "audioData is required" });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631" });
      }
      const aiInstance = new import_genai.GoogleGenAI({ apiKey });
      const availableModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
      let transcript = "";
      const promptText = isNumeric ? "\u0623\u0646\u062A \u0645\u062D\u0648\u0644 \u0635\u0648\u062A\u064A \u0641\u0627\u0626\u0642 \u0627\u0644\u062F\u0642\u0629 \u0648\u0645\u062D\u0648\u0644 \u0623\u0631\u0642\u0627\u0645 \u0645\u0627\u0644\u064A. \u062D\u0648\u0651\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0642\u0637\u0639 \u0627\u0644\u0635\u0648\u062A\u064A \u0627\u0644\u0639\u0631\u0628\u064A \u0628\u062F\u0642\u0629 \u0625\u0644\u0649 \u0631\u0642\u0645 \u062D\u0633\u0627\u0628\u064A \u0641\u0642\u0637 \u0628\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 (\u0645\u062B\u0644: 5000 \u0623\u0648 250 \u0623\u0648 15.5) \u0628\u062F\u0648\u0646 \u0623\u064A \u0643\u0644\u0645\u0627\u062A \u0623\u0648 \u0639\u0645\u0644\u0627\u062A \u0623\u0648 \u0646\u0635\u0648\u0635 \u0625\u0636\u0627\u0641\u064A\u0629 \u0623\u0648 \u0639\u0644\u0627\u0645\u0627\u062A \u062A\u0646\u0635\u064A\u0635. \u0625\u0630\u0627 \u0644\u0645 \u064A\u0643\u0646 \u0647\u0646\u0627\u0643 \u0631\u0642\u0645 \u0623\u0648 \u0643\u0644\u0627\u0645 \u0648\u0627\u0636\u062D\u060C \u0623\u0639\u062F \u0646\u0635\u0627\u064B \u0641\u0627\u0631\u063A\u0627\u064B." : "\u0623\u0646\u062A \u0645\u062D\u0648\u0644 \u0635\u0648\u062A\u064A \u0641\u0627\u0626\u0642 \u0627\u0644\u062F\u0642\u0629. \u062D\u0648\u0651\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0642\u0637\u0639 \u0627\u0644\u0635\u0648\u062A\u064A \u0627\u0644\u0639\u0631\u0628\u064A \u0628\u062F\u0642\u0629 \u0625\u0644\u0649 \u0646\u0635 \u0645\u0643\u062A\u0648\u0628 \u0641\u0642\u0637 \u0628\u062F\u0648\u0646 \u0623\u064A \u0645\u0642\u062F\u0645\u0627\u062A \u0623\u0648 \u062A\u0639\u0644\u064A\u0642\u0627\u062A \u0623\u0648 \u0634\u0631\u0648\u062D\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0623\u0648 \u0639\u0644\u0627\u0645\u0627\u062A \u062A\u0646\u0635\u064A\u0635. \u0625\u0630\u0627 \u0644\u0645 \u064A\u0643\u0646 \u0647\u0646\u0627\u0643 \u0643\u0644\u0627\u0645 \u0648\u0627\u0636\u062D\u060C \u0623\u0639\u062F \u0646\u0635\u0627\u064B \u0641\u0627\u0631\u063A\u0627\u064B.";
      for (const m of availableModels) {
        try {
          const geminiRes = await aiInstance.models.generateContent({
            model: m,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || "audio/webm",
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
          transcript = geminiRes.text?.trim() || "";
          if (transcript) break;
        } catch (err) {
          console.warn(`Model ${m} failed for audio transcription, trying next:`, err);
        }
      }
      res.json({ transcript });
    } catch (error) {
      console.error("Audio transcription error:", error);
      res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0641\u064A \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0635\u0648\u062A \u0625\u0644\u0649 \u0646\u0635" });
    }
  });
  app.get("/api/assistant/tts", async (req, res) => {
    try {
      const text = (req.query.text || "").trim();
      if (!text) {
        return res.status(400).send("Text parameter is required");
      }
      const clean = text.replace(/[\*#_`~]/g, "").replace(/<[^>]*>?/gm, "").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").replace(/https?:\/\/\S+/g, "").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "").trim();
      if (!clean) {
        return res.status(400).send("No valid text to speak");
      }
      const spokenChunk = clean.slice(0, 280);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=gtx&q=${encodeURIComponent(spokenChunk)}`;
      const audioRes = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-N986B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36"
        }
      });
      if (!audioRes.ok) {
        return res.status(audioRes.status).send("TTS fetch failed");
      }
      const buffer = Buffer.from(await audioRes.arrayBuffer());
      if (buffer.length < 100) {
        return res.status(502).send("Received empty audio payload");
      }
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (err) {
      console.error("TTS endpoint error:", err);
      res.status(500).send(err.message || "TTS failed");
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  let ai = null;
  try {
    if (process.env.GEMINI_API_KEY) {
      ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
  const wss = new import_ws.WebSocketServer({ server, path: "/live" });
  wss.on("connection", async (clientWs) => {
    if (!ai) {
      console.error("Gemini API key is missing. Connection rejected.");
      clientWs.close();
      return;
    }
    try {
      const session2 = await ai.live.connect({
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
          }
        },
        config: {
          responseModalities: [import_genai.Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: {
            parts: [{ text: "\u0623\u0646\u062A \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u062E\u0628\u064A\u0631 \u0644\u062A\u0637\u0628\u064A\u0642 (\u0627\u0644\u0641\u064A\u0635\u0644 \u0644\u0644\u0635\u064A\u0627\u0646\u0629) \u0648\u062A\u0639\u0645\u0644 \u0628\u0645\u062D\u0631\u0643 \u062C\u064A\u0645\u064A\u0646\u0627\u064A (Gemini). \u0644\u062F\u064A\u0643 \u0627\u0637\u0644\u0627\u0639 \u0643\u0627\u0645\u0644 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0623\u0648 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0639\u0628\u0631 \u0627\u0633\u062A\u062F\u0639\u0627\u0621 (undoAction). \u0627\u0633\u062A\u062E\u062F\u0645 \u0648\u0639\u064A\u0643 \u0644\u0644\u062A\u0639\u0644\u0645 \u0645\u0646 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u060C \u0648\u0646\u0641\u0630 \u0627\u0644\u0623\u062F\u0648\u0627\u062A \u0628\u062F\u0642\u0629 \u0648\u0627\u062D\u062A\u0631\u0627\u0641\u064A\u0629 \u0639\u0627\u0644\u064A\u0629." }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "searchQuery",
                description: "\u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0639\u0628\u0631 \u0634\u0631\u064A\u0637 \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0633\u0631\u064A\u0639",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    query: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0631\u0627\u062F \u0627\u0644\u0628\u062D\u062B \u0639\u0646\u0647" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "addTask",
                description: "\u0623\u0636\u0641 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u062C\u062F\u064A\u062F\u0629.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    customerName: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644" },
                    deviceType: { type: import_genai.Type.STRING, description: "\u0646\u0648\u0639 \u0627\u0644\u062C\u0647\u0627\u0632 (\u0645\u062B\u0644: \u0644\u0627\u0628\u062A\u0648\u0628\u060C \u0647\u0627\u062A\u0641)" },
                    brand: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0645\u0627\u0631\u0643\u0629 (\u0645\u062B\u0644: \u0633\u0627\u0645\u0633\u0648\u0646\u062C\u060C \u062F\u064A\u0644)" },
                    issue: { type: import_genai.Type.STRING, description: "\u0648\u0635\u0641 \u0627\u0644\u0639\u0637\u0644" },
                    cost: { type: import_genai.Type.NUMBER, description: "\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629" }
                  },
                  required: ["customerName", "deviceType", "issue"]
                }
              },
              {
                name: "updateTaskStatus",
                description: "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629 \u0645\u0648\u062C\u0648\u062F\u0629.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    taskId: { type: import_genai.Type.NUMBER, description: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 (ID)" },
                    status: { type: import_genai.Type.STRING, description: "\u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 (\u0645\u062B\u0644: \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0633\u0644\u064A\u0645\u060C \u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645\u060C \u0642\u064A\u062F \u0627\u0644\u0641\u062D\u0635\u060C \u0645\u0644\u063A\u064A)" }
                  },
                  required: ["taskId", "status"]
                }
              },
              {
                name: "updateSetting",
                description: "\u062A\u063A\u064A\u064A\u0631 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0623\u0648 \u0627\u0644\u0645\u0638\u0647\u0631.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    settingKey: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0625\u0639\u062F\u0627\u062F (\u0645\u062B\u0644: dark_mode, primary_color)" },
                    settingValue: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0625\u0639\u062F\u0627\u062F" }
                  },
                  required: ["settingKey", "settingValue"]
                }
              },
              {
                name: "addCustomer",
                description: "\u0625\u0636\u0627\u0641\u0629 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F \u0645\u0639 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    name: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644" },
                    phone: { type: import_genai.Type.STRING, description: "\u0631\u0642\u0645 \u062C\u0648\u0627\u0644 \u0627\u0644\u0639\u0645\u064A\u0644" }
                  },
                  required: ["name"]
                }
              },
              {
                name: "addDeviceModel",
                description: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u062F\u064A\u0644 \u0644\u0646\u0648\u0639 \u062C\u0647\u0627\u0632 \u0645\u0639\u064A\u0646.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    deviceType: { type: import_genai.Type.STRING, description: "\u0646\u0648\u0639 \u0627\u0644\u062C\u0647\u0627\u0632" },
                    brand: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0645\u0627\u0631\u0643\u0629" },
                    modelName: { type: import_genai.Type.STRING, description: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u062F\u064A\u0644 \u0627\u0644\u062C\u062F\u064A\u062F" }
                  },
                  required: ["deviceType", "modelName"]
                }
              },
              {
                name: "shareToWhatsApp",
                description: "\u0646\u0633\u062E \u0648\u0645\u0634\u0627\u0631\u0643\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0647\u0645\u0629 \u0644\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648 \u0644\u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u064A\u0644/\u0631\u0642\u0645 \u0627\u0644\u0641\u064A\u0635\u0644\u064A.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    taskId: { type: import_genai.Type.NUMBER, description: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 (ID) \u0627\u0644\u0645\u0631\u0627\u062F \u0645\u0634\u0627\u0631\u0643\u062A\u0647\u0627" },
                    target: { type: import_genai.Type.STRING, description: "\u0627\u0644\u0647\u062F\u0641 \u0644\u0644\u0645\u0634\u0627\u0631\u0643\u0629 (customer \u0623\u0648 faisali)" }
                  },
                  required: ["taskId"]
                }
              },
              {
                name: "addDeposit",
                description: "\u0625\u0636\u0627\u0641\u0629 \u062F\u0641\u0639\u0629 \u0645\u0642\u062F\u0645 \u0644\u0645\u0647\u0645\u0629 \u0635\u064A\u0627\u0646\u0629.",
                parameters: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    taskId: { type: import_genai.Type.NUMBER, description: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 (ID)" },
                    amount: { type: import_genai.Type.NUMBER, description: "\u0645\u0628\u0644\u063A \u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0645\u0642\u062F\u0645\u0629" }
                  },
                  required: ["taskId", "amount"]
                }
              }
            ]
          }]
        }
      });
      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session2.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          }
          if (msg.toolResponse) {
            session2.sendToolResponse({
              functionResponses: msg.toolResponse
            });
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      });
      clientWs.on("close", () => {
      });
    } catch (err) {
      console.error("Error setting up live api:", err);
    }
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
