package com.faisalysoft.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.faisalysoft.app.MainActivity;

/**
 * مستقبل رسائل SMS المالية الواردة (الكريمي، العمقي، بنك التضامن، ون كاش، فلوسك، جوالي، إلخ).
 * يقوم بقراءة الرسالة والتحقق منها وتمريرها فوراً إلى الواجهة والمساعد الذكي وقائمة التنبيهات الرئيسية.
 */
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "SmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }

        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) {
            return;
        }

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) {
                return;
            }

            String format = bundle.getString("format");
            StringBuilder fullMessage = new StringBuilder();
            String sender = "";

            for (Object pdu : pdus) {
                SmsMessage smsMessage;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                }

                if (smsMessage != null) {
                    if (sender.isEmpty()) {
                        sender = smsMessage.getDisplayOriginatingAddress();
                    }
                    String bodyPart = smsMessage.getMessageBody();
                    if (bodyPart != null) {
                        fullMessage.append(bodyPart);
                    }
                }
            }

            String messageText = fullMessage.toString().trim();
            if (messageText.isEmpty()) {
                return;
            }

            Log.d(TAG, "Incoming SMS from: " + sender + " | Body: " + messageText);

            // التحقق من كونها رسالة مالية أو مصرفية
            boolean isFinancial = messageText.contains("أودع") ||
                                  messageText.contains("اودع") ||
                                  messageText.contains("إيداع") ||
                                  messageText.contains("ايداع") ||
                                  messageText.contains("تحويل") ||
                                  messageText.contains("حوالة") ||
                                  messageText.contains("ريال") ||
                                  messageText.contains("مبلغ") ||
                                  messageText.contains("سداد") ||
                                  messageText.contains("خصم") ||
                                  messageText.contains("سحب") ||
                                  messageText.contains("SAR") ||
                                  messageText.contains("USD") ||
                                  messageText.contains("ر.ي") ||
                                  messageText.contains("ر.س") ||
                                  sender.toLowerCase().contains("bank") ||
                                  sender.contains("كريمي") ||
                                  sender.contains("عمقي") ||
                                  sender.contains("تضامن") ||
                                  sender.toLowerCase().contains("kuraimi") ||
                                  sender.toLowerCase().contains("amqi");

            if (isFinancial && MainActivity.getInstance() != null) {
                MainActivity.getInstance().dispatchBankNotification(sender, messageText, "sms");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing incoming SMS", e);
        }
    }
}
