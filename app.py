from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FOLDER = os.path.join(BASE_DIR, "sample_data")


def read_csv_file(filename):
    filepath = os.path.join(DATA_FOLDER, filename)
    df = pd.read_csv(filepath)
    return df.to_dict(orient="records")


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/login")
def login():
    return send_from_directory(".", "login.html")


@app.route("/api/transactions")
def get_transactions():
    return jsonify(read_csv_file("budgetwise_transactions.csv"))


@app.route("/api/budgets")
def get_budgets():
    return jsonify(read_csv_file("budgetwise_budgets.csv"))


@app.route("/api/categories")
def get_categories():
    return jsonify(read_csv_file("budgetwise_categories.csv"))


@app.route("/api/challenge")
def get_challenge():
    return jsonify(read_csv_file("budgetwise_challenge.csv"))


@app.route("/api/settings")
def get_settings():
    return jsonify(read_csv_file("budgetwise_settings.csv"))


if __name__ == "__main__":
    app.run(debug=True)