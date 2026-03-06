# STACK_OVERLODE_VORTEX_20
Pre-Interview Question Audit Tool Creates role-specific structured interview guides with only bias-minimized, legally compliant  questions. Slack integration lets interviewers type "/precheck [question]" for instant assessment.  Containerized NLP classifier with FastAPI backend for team-level audit logging.
# Project Name

**Description:**
A project containing a dataset of safe and flagged interview questions for HR and technical assessments. Users can use this CSV for analytics, filtering, or automated question auditing.

---

## Features

* Bulk dataset of interview questions (Safe and Flagged)
* CSV file for easy import
* Can be extended for NLP analysis or filtering

---

## Prerequisites

Before running the project, ensure you have installed:

* Git: [https://git-scm.com/downloads](https://git-scm.com/downloads)
* Python 3.x: [https://www.python.org/downloads/](https://www.python.org/downloads/)
* Optional: Virtual environment tool (venv or conda)

---

## Steps to Execute the Project

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/<repository-name>.git
cd <repository-name>
```

### 2. Set Up Virtual Environment (Optional)

```bash
python -m venv venv
# Activate the environment
# Windows
env\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

*Skip if no requirements file exists*

### 4. Check CSV Dataset

The CSV file (`bulk_interview_questions_1000.csv`) is included.

```python
import pandas as pd

df = pd.read_csv('bulk_interview_questions_1000.csv')
print(df.head())
```

### 5. Run the Project

* Python script:

```bash
python main.py
```

* Flask app:

```bash
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

* Node.js app:

```bash
npm install
node server.js
```

### 6. Explore Features

* Load CSV into scripts or dashboards
* Filter Safe and Flagged questions
* Add analytics, visualizations, or NLP processing

---

## Optional: Contribute

1. Fork the repository
2. Create a branch: `git checkout -b feature-name`
3. Make changes
4. Commit: `git commit -m "Add feature"`
5. Push: `git push origin
