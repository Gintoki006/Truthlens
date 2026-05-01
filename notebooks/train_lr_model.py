import os
import urllib.request
import zipfile
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from pathlib import Path

# Paths
MODELS_DIR = Path(__file__).parent.parent / "backend" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

TFIDF_PATH = MODELS_DIR / "tfidf_vectorizer.pkl"
LR_PATH = MODELS_DIR / "lr_model.pkl"
DATA_DIR = Path(__file__).parent.parent / "data" / "liar"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def download_and_extract_liar():
    zip_path = DATA_DIR / "liar_dataset.zip"
    if not zip_path.exists():
        print("Downloading LIAR dataset zip...")
        url = "http://www.cs.ucsb.edu/~william/data/liar_dataset.zip"
        urllib.request.urlretrieve(url, zip_path)
    
    if not (DATA_DIR / "train.tsv").exists():
        print("📦 Extracting zip...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(DATA_DIR)

def main():
    download_and_extract_liar()
    
    print("📥 Loading LIAR dataset...")
    
    columns = ["id", "label", "statement", "subject", "speaker", "job", "state", "party", 
               "barely_true_counts", "false_counts", "half_true_counts", "mostly_true_counts", 
               "pants_on_fire_counts", "context"]
    
    try:
        train_df = pd.read_csv(DATA_DIR / "train.tsv", sep="\t", header=None, names=columns)
        test_df = pd.read_csv(DATA_DIR / "test.tsv", sep="\t", header=None, names=columns)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    print(f"📊 Training samples: {len(train_df)}")
    print(f"📊 Testing samples:  {len(test_df)}")
    
    # ── Preprocessing ────────────────────────────────────────────────────────
    # We want a BINARY classification:
    # 0 = FAKE (pants-fire, false, barely-true)
    # 1 = REAL (half-true, mostly-true, true)
    
    def map_label(label_str):
        if not isinstance(label_str, str): return 0
        label_str = label_str.lower().strip()
        if label_str in ["pants-fire", "false", "barely-true"]:
            return 0  # FAKE
        elif label_str in ["half-true", "mostly-true", "true"]:
            return 1  # REAL
        return 0

    print("⚙️ Preprocessing text and mapping labels to Binary (Fake=0, Real=1)...")
    if "label" not in train_df.columns:
        # Fallback if names didn't map perfectly
        y_train = train_df[1].apply(map_label)
        y_test = test_df[1].apply(map_label)
        X_train_raw = train_df[2].fillna("")
        X_test_raw = test_df[2].fillna("")
    else:
        y_train = train_df["label"].apply(map_label)
        y_test = test_df["label"].apply(map_label)
        X_train_raw = train_df["statement"].fillna("")
        X_test_raw = test_df["statement"].fillna("")
    
    # ── Feature Extraction ───────────────────────────────────────────────────
    print("📈 Vectorizing text using TF-IDF (max 10,000 features)...")
    vectorizer = TfidfVectorizer(
        stop_words="english", 
        max_features=10000, 
        ngram_range=(1, 2)
    )
    
    X_train = vectorizer.fit_transform(X_train_raw)
    X_test = vectorizer.transform(X_test_raw)
    
    # ── Training ─────────────────────────────────────────────────────────────
    print("🧠 Training Logistic Regression model...")
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    
    # ── Evaluation ───────────────────────────────────────────────────────────
    print("✅ Evaluating model on test set...")
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {acc * 100:.2f}%\n")
    print(classification_report(y_test, y_pred, target_names=["FAKE (0)", "REAL (1)"]))
    
    # ── Saving ───────────────────────────────────────────────────────────────
    print(f"💾 Saving TF-IDF vectorizer to {TFIDF_PATH}")
    joblib.dump(vectorizer, TFIDF_PATH)
    
    print(f"💾 Saving Logistic Regression model to {LR_PATH}")
    joblib.dump(model, LR_PATH)
    print("🎉 Done! Backend API can now use Model B.")

if __name__ == "__main__":
    main()
