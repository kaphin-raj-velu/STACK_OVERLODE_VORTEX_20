"""
BERT Fine-Tuning Script for Interview Bias Detection
Usage: python train.py --epochs 5 --batch_size 16
"""
import os, argparse
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertForSequenceClassification, get_linear_schedule_with_warmup
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from torch.optim import AdamW

parser = argparse.ArgumentParser()
parser.add_argument("--epochs",       type=int,   default=5)
parser.add_argument("--batch_size",   type=int,   default=16)
parser.add_argument("--lr",           type=float, default=2e-5)
parser.add_argument("--max_len",      type=int,   default=128)
parser.add_argument("--model_name",   type=str,   default="bert-base-uncased")
parser.add_argument("--output_dir",   type=str,   default="./saved_model")
parser.add_argument("--dataset_path", type=str,   default="../dataset/interview_questions.csv")
args = parser.parse_args()

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {DEVICE}")

class InterviewDataset(Dataset):
    def __init__(self, questions, labels, tokenizer, max_len):
        self.questions, self.labels, self.tokenizer, self.max_len = questions, labels, tokenizer, max_len
    def __len__(self): return len(self.questions)
    def __getitem__(self, idx):
        enc = self.tokenizer(str(self.questions[idx]), max_length=self.max_len,
                             padding="max_length", truncation=True, return_tensors="pt")
        return {k: v.squeeze() for k, v in enc.items()} | {"label": torch.tensor(self.labels[idx], dtype=torch.long)}

df = pd.read_csv(args.dataset_path).dropna(subset=["question","label"])
df["label_enc"] = df["label"].map({"Safe":0,"Flagged":1}).dropna().astype(int)
df = df.dropna(subset=["label_enc"])

X_tr, X_te, y_tr, y_te = train_test_split(df["question"].values, df["label_enc"].values,
                                           test_size=0.2, random_state=42, stratify=df["label_enc"])
print(f"Train: {len(X_tr)}  Test: {len(X_te)}")

tokenizer = BertTokenizer.from_pretrained(args.model_name)
model     = BertForSequenceClassification.from_pretrained(args.model_name, num_labels=2).to(DEVICE)

tr_loader = DataLoader(InterviewDataset(X_tr, y_tr, tokenizer, args.max_len), batch_size=args.batch_size, shuffle=True)
te_loader = DataLoader(InterviewDataset(X_te, y_te, tokenizer, args.max_len), batch_size=args.batch_size)

optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
scheduler = get_linear_schedule_with_warmup(optimizer,
    num_warmup_steps=len(tr_loader)*args.epochs//10,
    num_training_steps=len(tr_loader)*args.epochs)

best_acc = 0.0
for epoch in range(args.epochs):
    model.train()
    total_loss = 0
    for batch in tr_loader:
        optimizer.zero_grad()
        out = model(input_ids=batch["input_ids"].to(DEVICE),
                    attention_mask=batch["attention_mask"].to(DEVICE),
                    token_type_ids=batch["token_type_ids"].to(DEVICE),
                    labels=batch["label"].to(DEVICE))
        out.loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step(); scheduler.step()
        total_loss += out.loss.item()

    model.eval()
    preds, actuals = [], []
    with torch.no_grad():
        for batch in te_loader:
            logits = model(input_ids=batch["input_ids"].to(DEVICE),
                           attention_mask=batch["attention_mask"].to(DEVICE),
                           token_type_ids=batch["token_type_ids"].to(DEVICE)).logits
            preds.extend(torch.argmax(logits, dim=-1).cpu().numpy())
            actuals.extend(batch["label"].numpy())
    acc = accuracy_score(actuals, preds)
    print(f"Epoch {epoch+1}/{args.epochs}  loss={total_loss/len(tr_loader):.4f}  acc={acc:.4f}")
    if acc > best_acc:
        best_acc = acc
        os.makedirs(args.output_dir, exist_ok=True)
        model.save_pretrained(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)
        print(f"  ✅ Saved (best acc: {best_acc:.4f})")

print("\n" + classification_report(actuals, preds, target_names=["Safe","Flagged"]))
