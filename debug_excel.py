import pandas as pd
from pathlib import Path

excel_path = Path("data/raw/slutligt-valresultat-riksdagen-jamforande-statistik-2018-2022.xlsx")
xls = pd.ExcelFile(excel_path)

print("--- SHEET NAMES ---")
print(xls.sheet_names)

print("\n--- FIRST 5 ROWS OF SHEET 0 ---")
df = pd.read_excel(excel_path, sheet_name=0)
print(df.head())