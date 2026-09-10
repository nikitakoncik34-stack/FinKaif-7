# Finkaif v0.6 — Railway Fixed

## Почему предыдущая версия показывала Not Found
В этой версии исправлен путь к главной странице: сервер использует абсолютный путь рядом с `server.js`, а не текущую рабочую папку Railway. Поэтому `public/index.html` будет найден при правильной структуре репозитория.

## Делайте строго по шагам

### 1. GitHub
Создайте НОВЫЙ пустой репозиторий, например `finkaif-railway`.

Распакуйте архив. Загрузите **содержимое папки `Finkaif_Railway_fixed`**, а не сам ZIP и не эту папку целиком.

В корне репозитория после загрузки должны быть:
```
package.json
server.js
railway.json
public/index.html
public/app.js
public/style.css
db/schema.sql
```

### 2. Railway — приложение
- New Project → Deploy from GitHub Repo → выберите этот репозиторий.
- Root Directory: оставьте **пустым**.
- Start Command: оставьте автоматически или укажите `npm start`.

### 3. Railway — база
В ТОМ ЖЕ Railway Project: New → Database → PostgreSQL.

### 4. Переменные приложения
Откройте сервис приложения (не Postgres) → Variables и добавьте:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=придумайте длинную уникальную строку, минимум 32 символа
NODE_ENV=production
```
Если сервис базы назван не `Postgres`, подставьте его точное имя в `${{ИМЯ.DATABASE_URL}}`.

Для ИИ добавьте позже:
```
OPENAI_API_KEY=ваш секретный ключ
OPENAI_MODEL=gpt-4o-mini
```

### 5. Создание таблиц
Выполните весь текст из `db/schema.sql` в SQL Query-инструменте PostgreSQL Railway. Это обязательно.

### 6. Перезапуск и ссылка
После добавления Variables запустите Deploy Latest Commit / Redeploy. В конце логов должно быть:
```
Finkaif is running on port 3000
```
Только после этого в Settings сервиса приложения → Public Networking → Generate Domain создайте ссылку.

### 7. Проверка
Откройте `https://ваш-домен.up.railway.app/health`.
Если показывает `{"ok":true}`, сервер и база работают. Затем откройте сам домен без `/health` — появится Finkaif.

## Никогда не публикуйте
Не коммитьте `.env`, `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL` или пароль базы данных в GitHub.
