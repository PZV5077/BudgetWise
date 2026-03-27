from flask import Flask, jsonify, send_from_directory, request, session, redirect
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pymysql
from pymysql.cursors import DictCursor
from datetime import timedelta
from uuid import uuid4

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# CHANGE THESE
app.config["SECRET_KEY"] = "PLACEHOLDER_SECRET_KEY_CHANGE_ME"
DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "root"
DB_PASSWORD = "PLACEHOLDER_DB_PASSWORD_CHANGE_ME"
DB_NAME = "budgetwise"

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.permanent_session_lifetime = timedelta(days=30)

DEFAULT_EXPENSE_CATS = [
    "Housing", "Groceries", "Transport", "Utilities", "Entertainment",
    "Dining Out", "Health", "Shopping", "Education", "Subscriptions", "Other"
]

DEFAULT_INCOME_CATS = [
    "Salary", "Freelance", "Investments", "Benefits", "Gifts", "Other"
]

DEFAULT_SETTINGS = {
    "theme_primary": "#2563eb",
    "theme_accent": "#059669",
    "theme_bg": "#f8f9fa",
    "theme_card": "#ffffff",
    "theme_text": "#1a1a2e",
}


def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=DictCursor,
        autocommit=True
    )


PUBLIC_PATHS = {"/login", "/signup", "/api/login", "/api/signup"}


def current_user_id():
    return session["user_id"]


def bool_from_value(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def ensure_user_defaults(conn, user_id):
    with conn.cursor() as cursor:
        for name in DEFAULT_EXPENSE_CATS:
            cursor.execute(
                """
                INSERT IGNORE INTO categories (user_id, type, name)
                VALUES (%s, %s, %s)
                """,
                (user_id, "expense", name)
            )

        for name in DEFAULT_INCOME_CATS:
            cursor.execute(
                """
                INSERT IGNORE INTO categories (user_id, type, name)
                VALUES (%s, %s, %s)
                """,
                (user_id, "income", name)
            )

        for key, value in DEFAULT_SETTINGS.items():
            cursor.execute(
                """
                INSERT INTO settings (user_id, setting_key, setting_value)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE setting_value = setting_value
                """,
                (user_id, key, value)
            )


@app.before_request
def require_login():
    if request.method == "OPTIONS":
        return None

    if request.endpoint == "static":
        return None

    if request.path in PUBLIC_PATHS or request.path == "/favicon.ico":
        return None

    if "user_id" in session:
        return None

    if request.path.startswith("/api/"):
        return jsonify({"message": "Please log in first."}), 401

    return redirect("/login")


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/login")
def login():
    if "user_id" in session:
        return redirect("/")
    return send_from_directory(".", "login.html")


@app.route("/signup")
def signup():
    if "user_id" in session:
        return redirect("/")
    return send_from_directory(".", "signup.html")


@app.route("/api/signup", methods=["POST"])
def api_signup():
    data = request.get_json(silent=True) or {}

    first_name = str(data.get("firstName", "")).strip()
    last_name = str(data.get("lastName", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not first_name or not last_name or not email or not password:
        return jsonify({"message": "Fill in every field."}), 400

    if len(password) < 8:
        return jsonify({"message": "Password must be at least 8 characters."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            existing_user = cursor.fetchone()

            if existing_user:
                return jsonify({"message": "An account with that email already exists."}), 409

            password_hash = generate_password_hash(password)

            cursor.execute(
                """
                INSERT INTO users (first_name, last_name, email, password_hash)
                VALUES (%s, %s, %s, %s)
                """,
                (first_name, last_name, email, password_hash)
            )
            user_id = cursor.lastrowid

        ensure_user_defaults(conn, user_id)

        return jsonify({
            "message": "Account created successfully.",
            "redirect": "/login"
        }), 201

    except Exception as e:
        return jsonify({"message": "Could not create account.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    remember = bool(data.get("remember", False))

    if not email or not password:
        return jsonify({"message": "Enter your email and password."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, email, password_hash FROM users WHERE email = %s",
                (email,)
            )
            user = cursor.fetchone()

        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"message": "Invalid email or password."}), 401

        ensure_user_defaults(conn, user["id"])

        session.clear()
        session["user_id"] = user["id"]
        session["user_email"] = user["email"]
        session.permanent = remember

        return jsonify({
            "message": "Login successful.",
            "redirect": "/"
        })

    except Exception as e:
        return jsonify({"message": "Could not log in.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"message": "Logged out successfully.", "redirect": "/login"})


@app.route("/api/me")
def api_me():
    return jsonify({
        "user_id": session["user_id"],
        "email": session.get("user_email", "")
    })


@app.route("/api/transactions")
def get_transactions():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, date, type, category, description, amount, notes
                FROM transactions
                WHERE user_id = %s
                ORDER BY date DESC, created_at DESC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        data = [
            {
                "ID": row["id"],
                "Date": row["date"].strftime("%Y-%m-%d") if row["date"] else "",
                "Type": row["type"],
                "Category": row["category"],
                "Description": row["description"],
                "Amount": float(row["amount"]),
                "Notes": row["notes"] or ""
            }
            for row in rows
        ]
        return jsonify(data)

    except Exception as e:
        return jsonify({"message": "Could not load transactions.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/transactions", methods=["POST"])
def create_transaction():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    txn_id = str(data.get("id") or uuid4().hex[:16]).strip()
    date = str(data.get("date", "")).strip()
    txn_type = str(data.get("type", "")).strip().lower()
    category = str(data.get("category", "")).strip()
    description = str(data.get("description", "")).strip()
    notes = str(data.get("notes", "")).strip()
    amount = data.get("amount")

    if txn_type not in {"income", "expense"}:
        return jsonify({"message": "Transaction type must be income or expense."}), 400
    if not date or not category or not description:
        return jsonify({"message": "Date, category, and description are required."}), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"message": "Amount must be a number."}), 400

    if amount <= 0:
        return jsonify({"message": "Amount must be greater than 0."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO transactions (id, user_id, date, type, category, description, amount, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (txn_id, user_id, date, txn_type, category, description, amount, notes)
            )

        return jsonify({"message": "Transaction created.", "id": txn_id}), 201

    except Exception as e:
        return jsonify({"message": "Could not create transaction.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/transactions/<transaction_id>", methods=["PUT"])
def update_transaction(transaction_id):
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    date = str(data.get("date", "")).strip()
    txn_type = str(data.get("type", "")).strip().lower()
    category = str(data.get("category", "")).strip()
    description = str(data.get("description", "")).strip()
    notes = str(data.get("notes", "")).strip()
    amount = data.get("amount")

    if txn_type not in {"income", "expense"}:
        return jsonify({"message": "Transaction type must be income or expense."}), 400
    if not date or not category or not description:
        return jsonify({"message": "Date, category, and description are required."}), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"message": "Amount must be a number."}), 400

    if amount <= 0:
        return jsonify({"message": "Amount must be greater than 0."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE transactions
                SET date = %s, type = %s, category = %s, description = %s, amount = %s, notes = %s
                WHERE id = %s AND user_id = %s
                """,
                (date, txn_type, category, description, amount, notes, transaction_id, user_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "Transaction not found."}), 404

        return jsonify({"message": "Transaction updated."})

    except Exception as e:
        return jsonify({"message": "Could not update transaction.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/transactions/<transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM transactions WHERE id = %s AND user_id = %s",
                (transaction_id, user_id)
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "Transaction not found."}), 404

        return jsonify({"message": "Transaction deleted."})

    except Exception as e:
        return jsonify({"message": "Could not delete transaction.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/budgets")
def get_budgets():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT month, type, category, value
                FROM budgets
                WHERE user_id = %s
                ORDER BY month ASC, type ASC, category ASC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        data = [
            {
                "Month": row["month"],
                "Type": row["type"],
                "Category": row["category"] or "",
                "Value": float(row["value"])
            }
            for row in rows
        ]
        return jsonify(data)

    except Exception as e:
        return jsonify({"message": "Could not load budgets.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/budgets", methods=["PUT"])
def upsert_budget():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    month = str(data.get("month", "")).strip()
    budget_type = str(data.get("type", "")).strip().lower()
    category = str(data.get("category", "") or "").strip()
    value = data.get("value")

    if not month:
        return jsonify({"message": "Month is required."}), 400
    if budget_type not in {"overall", "category"}:
        return jsonify({"message": "Budget type must be overall or category."}), 400
    if budget_type == "overall":
        category = ""
    elif not category:
        return jsonify({"message": "Category is required for category budgets."}), 400

    try:
        value = float(value)
    except (TypeError, ValueError):
        return jsonify({"message": "Budget value must be a number."}), 400

    if value < 0:
        return jsonify({"message": "Budget value cannot be negative."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO budgets (user_id, month, type, category, value)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE value = VALUES(value)
                """,
                (user_id, month, budget_type, category, value)
            )

        return jsonify({"message": "Budget saved."})

    except Exception as e:
        return jsonify({"message": "Could not save budget.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/budgets", methods=["DELETE"])
def delete_budget():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    month = str(data.get("month", "")).strip()
    budget_type = str(data.get("type", "")).strip().lower()
    category = str(data.get("category", "") or "").strip()

    if not month or budget_type not in {"overall", "category"}:
        return jsonify({"message": "Month and valid budget type are required."}), 400
    if budget_type == "overall":
        category = ""
    elif not category:
        return jsonify({"message": "Category is required for category budgets."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM budgets
                WHERE user_id = %s AND month = %s AND type = %s AND category = %s
                """,
                (user_id, month, budget_type, category)
            )

        return jsonify({"message": "Budget deleted."})

    except Exception as e:
        return jsonify({"message": "Could not delete budget.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/categories")
def get_categories():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        ensure_user_defaults(conn, user_id)

        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT type, name
                FROM categories
                WHERE user_id = %s
                ORDER BY type ASC, name ASC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        data = [{"Type": row["type"], "Name": row["name"]} for row in rows]
        return jsonify(data)

    except Exception as e:
        return jsonify({"message": "Could not load categories.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/categories", methods=["POST"])
def create_category():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    category_type = str(data.get("type", "")).strip().lower()
    name = str(data.get("name", "")).strip()

    if category_type not in {"expense", "income"}:
        return jsonify({"message": "Category type must be expense or income."}), 400
    if not name:
        return jsonify({"message": "Category name is required."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT IGNORE INTO categories (user_id, type, name)
                VALUES (%s, %s, %s)
                """,
                (user_id, category_type, name)
            )

        return jsonify({"message": "Category saved."}), 201

    except Exception as e:
        return jsonify({"message": "Could not save category.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/categories", methods=["DELETE"])
def delete_category():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    category_type = str(data.get("type", "")).strip().lower()
    name = str(data.get("name", "")).strip()

    if category_type not in {"expense", "income"} or not name:
        return jsonify({"message": "Category type and name are required."}), 400

    if name in DEFAULT_EXPENSE_CATS and category_type == "expense":
        return jsonify({"message": "Default expense categories cannot be removed."}), 400
    if name in DEFAULT_INCOME_CATS and category_type == "income":
        return jsonify({"message": "Default income categories cannot be removed."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM categories WHERE user_id = %s AND type = %s AND name = %s",
                (user_id, category_type, name)
            )
            cursor.execute(
                "DELETE FROM budgets WHERE user_id = %s AND type = 'category' AND category = %s",
                (user_id, name)
            )

        return jsonify({"message": "Category deleted."})

    except Exception as e:
        return jsonify({"message": "Could not delete category.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/challenge")
def get_challenge():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT start_date, saved_days, withdrawn
                FROM challenge
                WHERE user_id = %s
                """,
                (user_id,)
            )
            row = cursor.fetchone()

        if not row:
            return jsonify([])

        data = [{
            "StartDate": row["start_date"].strftime("%Y-%m-%d") if row["start_date"] else "",
            "SavedDays": row["saved_days"] or "",
            "Withdrawn": bool(row["withdrawn"])
        }]
        return jsonify(data)

    except Exception as e:
        return jsonify({"message": "Could not load challenge.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/challenge", methods=["PUT"])
def upsert_challenge():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    start_date = str(data.get("startDate", "")).strip()
    saved_days = data.get("savedDays", [])
    withdrawn = bool_from_value(data.get("withdrawn", False))

    if not start_date:
        return jsonify({"message": "Challenge start date is required."}), 400

    if isinstance(saved_days, list):
        saved_days_string = ";".join(str(int(day)) for day in sorted(set(saved_days)))
    else:
        saved_days_string = str(saved_days or "").strip()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO challenge (user_id, start_date, saved_days, withdrawn)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    start_date = VALUES(start_date),
                    saved_days = VALUES(saved_days),
                    withdrawn = VALUES(withdrawn)
                """,
                (user_id, start_date, saved_days_string, withdrawn)
            )

        return jsonify({"message": "Challenge saved."})

    except Exception as e:
        return jsonify({"message": "Could not save challenge.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/challenge", methods=["DELETE"])
def delete_challenge():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM challenge WHERE user_id = %s", (user_id,))
        return jsonify({"message": "Challenge reset."})

    except Exception as e:
        return jsonify({"message": "Could not reset challenge.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/settings")
def get_settings():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        ensure_user_defaults(conn, user_id)

        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT setting_key, setting_value
                FROM settings
                WHERE user_id = %s
                ORDER BY setting_key ASC
                """,
                (user_id,)
            )
            rows = cursor.fetchall()

        data = [{"Key": row["setting_key"], "Value": row["setting_value"]} for row in rows]
        return jsonify(data)

    except Exception as e:
        return jsonify({"message": "Could not load settings.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/settings", methods=["PUT"])
def upsert_settings():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    settings = data.get("settings")
    if settings is None:
        key = str(data.get("key", "")).strip()
        value = str(data.get("value", "")).strip()
        if not key:
            return jsonify({"message": "Provide either settings or a key/value pair."}), 400
        settings = {key: value}

    if not isinstance(settings, dict) or not settings:
        return jsonify({"message": "Settings payload must be a non-empty object."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            for key, value in settings.items():
                cursor.execute(
                    """
                    INSERT INTO settings (user_id, setting_key, setting_value)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                    """,
                    (user_id, str(key), str(value))
                )

        return jsonify({"message": "Settings saved."})

    except Exception as e:
        return jsonify({"message": "Could not save settings.", "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/reset", methods=["POST"])
def reset_user_data():
    user_id = current_user_id()
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM transactions WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM budgets WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM challenge WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM categories WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM settings WHERE user_id = %s", (user_id,))

        ensure_user_defaults(conn, user_id)

        return jsonify({"message": "All user data reset."})

    except Exception as e:
        return jsonify({"message": "Could not reset user data.", "error": str(e)}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)
