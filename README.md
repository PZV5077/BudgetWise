# BudgetWise


## Requirements

- Python 3
- MySQL Server

## Setup

### 1. Create the database

Open MySQL and run the SQL in `schema.sql`.

If you want to do it from the MySQL command line:

```sql
SOURCE schema.sql;
```

If that does not work because of the file path, copy the contents of `schema.sql` and paste it into MySQL manually.

### 2. Configure the backend

Open `app.py` and set these values at the top of the file:

```python
app.config["SECRET_KEY"] = "PLACEHOLDER_SECRET_KEY_CHANGE_ME"
DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "root"
DB_PASSWORD = "PLACEHOLDER_DB_PASSWORD_CHANGE_ME"
DB_NAME = "budgetwise"
```

Notes:
- `DB_PASSWORD` must match your local MySQL password
- Keep `DB_NAME` as `budgetwise` unless you also changed it in `schema.sql`

### 3. Install dependencies

Open a terminal in the project folder and run:

```bash
pip install -r requirements.txt
```

If you do not have a `requirements.txt` file yet, install these manually:

```bash
pip install Flask flask-cors Werkzeug PyMySQL cryptography
```

### 4. Run the app

In the project folder, run:

```bash
python app.py
```

### 5. Open the site

Open this in your browser:

`http://127.0.0.1:5000`

## Project files

These files should be kept in the same main project folder:

- `app.py`
- `js/app.js`
- `index.html`
- `login.html`
- `signup.html`
- `css/style.css`
- `schema.sql`

## Notes for running the project

- The app uses MySQL for user accounts and per-user stored data
- Each user account has its own transactions, budgets, challenge progress, categories, and settings
- New accounts start fresh
- The frontend and backend are designed to run locally through Flask

## Troubleshooting

### MySQL connection error

Check that:
- MySQL Server is installed and running
- The username and password in `app.py` are correct
- The database name matches `schema.sql`

### Login/signup not working

Check that:
- The `users` table exists
- You ran `schema.sql`
- The Flask app is running from the correct `app.py`

### Pages not loading properly

Make sure `index.html`, `login.html`, and `signup.html` are in the same folder as `app.py`

## summary

1. Install Python 3
2. Install MySQL Server
3. Run `schema.sql`
4. Set the database credentials in `app.py`
5. Run `pip install -r requirements.txt`
6. Run `python app.py`
7. Open `http://127.0.0.1:5000`
