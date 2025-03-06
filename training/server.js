const express = require("express");
const fs = require("fs");
const path = require("path");
const { createObjectCsvWriter } = require("csv-writer");
const ExcelJS = require("exceljs");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // لدعم البيانات القادمة من النماذج

// إعداد مجلد ثابت لتقديم الملفات
app.use(express.static(path.join(__dirname, 'public')));  // تأكد من وضع ملفات HTML في مجلد 'public'

// دالة Middleware للتحقق من المفتاح السري
const checkSecretKey = (req, res, next) => {
    // يمكنك تمرير المفتاح عبر query string أو من خلال الترويسة 'x-secret-key'
    const secretKey = req.query.secretKey || req.headers['x-secret-key'];
    if (secretKey && secretKey === "R123") {  // هنا تم استبدال "mySecretKey" بـ "R123"
        next();
    } else {
        res.status(401).send("غير مصرح به: المفتاح السري غير صحيح");
    }
};


// 🔹 تقديم صفحة النماذج عند الدخول إلى / (الرابط الأساسي)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));  // تأكد من وجود index.html في نفس المجلد
});

// 🔹 عرض البيانات المسجلة من JSON (محمي بالمفتاح السري)
app.get("/view-data", checkSecretKey, (req, res) => {
    const filePath = path.join(__dirname, "data.json");

    if (fs.existsSync(filePath)) {
        try {
            const fileContent = fs.readFileSync(filePath, "utf8");
            const data = JSON.parse(fileContent);
            res.json(data);  // إرسال البيانات في صيغة JSON
        } catch (error) {
            console.error("❌ خطأ في قراءة أو تحليل البيانات:", error);
            res.status(500).send("❌ حدث خطأ في تحميل البيانات.");
        }
    } else {
        console.error("❌ لا يوجد ملف data.json");
        res.status(404).send("❌ لا توجد بيانات.");
    }
});


// 🔹 حفظ البيانات في JSON
const saveToJSON = (data) => {
    try {
        const filePath = path.join(__dirname, "data.json");
        let existingData = [];

        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, "utf8");
            existingData = fileContent ? JSON.parse(fileContent) : [];
        }

        existingData.push(data);
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), "utf8");
    } catch (error) {
        console.error("❌ خطأ أثناء حفظ البيانات في JSON:", error);
    }
};

// 🔹 حفظ البيانات في CSV
const saveToCSV = async (data) => {
    try {
        const filePath = path.join(__dirname, "data.csv");

        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: "name", title: "الاسم" },
                { id: "email", title: "البريد الإلكتروني" },
                { id: "phone", title: "رقم الهاتف" }
            ],
            append: fs.existsSync(filePath) // إضافة البيانات بدلاً من إعادة الكتابة
        });

        await csvWriter.writeRecords([data]);
    } catch (error) {
        console.error("❌ خطأ أثناء حفظ البيانات في CSV:", error);
    }
};

// 🔹 استقبال بيانات التسجيل
app.post("/register", async (req, res) => {
    try {
        const userData = req.body;

        if (!userData.name || !userData.email || !userData.phone) {
            return res.status(400).json({ message: "❌ جميع الحقول مطلوبة!" });
        }

        saveToJSON(userData);
        await saveToCSV(userData);

        res.status(200).json({ message: "✅ تم التسجيل بنجاح!" });
    } catch (error) {
        console.error("❌ خطأ أثناء معالجة التسجيل:", error);
        res.status(500).json({ message: "❌ حدث خطأ في السيرفر!" });
    }
});

// 🔹 توفير ملف DOCX للتحميل بعد التسجيل
app.get("/download", (req, res) => {
    const filePath = path.join(__dirname, "COOP-TRAINING.docx"); // تأكد من أن الملف في نفس المجلد
    if (fs.existsSync(filePath)) {
        res.download(filePath, "COOP-TRAINING.docx");
    } else {
        res.status(404).send("❌ الملف غير موجود!");
    }
});

// 🔹 توفير ملف Excel للتحميل من البيانات المسجلة (محمي بالمفتاح السري)
app.get("/download-excel", checkSecretKey, async (req, res) => {
    const filePath = path.join(__dirname, "data.json");
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("❌ لا توجد بيانات.");
    }
    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(fileContent);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("البيانات");

        // تعريف الأعمدة
        worksheet.columns = [
            { header: "الاسم", key: "name", width: 30 },
            { header: "البريد الإلكتروني", key: "email", width: 30 },
            { header: "رقم الهاتف", key: "phone", width: 20 }
        ];

        // إضافة الصفوف
        data.forEach(item => {
            worksheet.addRow(item);
        });

        // إرسال الملف للتحميل
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=data.xlsx");

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("❌ خطأ أثناء إنشاء ملف Excel:", error);
        res.status(500).send("❌ حدث خطأ أثناء إنشاء ملف Excel.");
    }
});

// 🔹 تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});
