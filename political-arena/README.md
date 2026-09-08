# זירה פוליטית — MVP

Client-only React + TypeScript + Vite.

## מה כלול
- Copy/Paste של סקר אחד או כמה סקרים.
- AI parser בלבד: טקסט -> JSON לפי JSON Schema קשיח.
- הוספת סקר נוסף באמצעות אותו parser.
- בדיקת 120 דטרמיניסטית בקוד.
- עריכת כותרת, שמות מקורות, שמות מפלגות ומספרים.
- `--` לערך ללא מספר.
- Drag & Drop לסדר שורות ועמודות.
- שמירה אוטומטית ב-localStorage.
- התחלה מחדש.
- טעינת טקסט דוגמה.

## הפעלה

```bash
npm install
npm run dev
```

פתח את כתובת Vite.

בהפעלה הראשונה: הגדרות AI -> OpenAI API Key -> שמור.

> MVP client-only: המפתח נשמר ב-localStorage ונשלח ישירות מהדפדפן לשירות ה-AI. לפריסה ציבורית עדיף להעביר את קריאת ה-AI לשרת קטן כדי לא לחשוף API key.
