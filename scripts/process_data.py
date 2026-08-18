import json
from pathlib import Path
import sys
import pandas as pd
import geopandas as gdf
from shapely.geometry import shape

# Force UTF-8 encoding on Windows standard output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
INPUT_DIR = RAW_DIR / "districtData"
EXCEL_FILE_NAME = "Roster-per-distrikt-slutligt-antal-roster-inklusive-totalt-valdeltagande-riksdagsvalet-2022.xlsx"
EXCEL_PATH = RAW_DIR / EXCEL_FILE_NAME

OUTPUT_DIR = BASE_DIR / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "processed_val2022.json"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_vote_data():
    vote_results = {}

    if not EXCEL_PATH.exists():
        print(f"[ERROR] Could not find Excel file at: {EXCEL_PATH}")
        return vote_results

    print(f"[INFO] Reading Excel dataset: {EXCEL_PATH.name}...")
    df = pd.read_excel(EXCEL_PATH, sheet_name="roster_RD", engine="openpyxl")
    
    # Party Mapping
    party_map = {
        "S": "S", "ARBETAREPARTIET-SOCIALDEMOKRATERNA": "S", "SOCIALDEMOKRATERNA": "S",
        "M": "M", "MODERATERNA": "M",
        "SD": "SD", "SVERIGEDEMOKRATERNA": "SD",
        "V": "V", "VÄNSTERPARTIET": "V",
        "C": "C", "CENTERPARTIET": "C",
        "KD": "KD", "KRISTDEMOKRATERNA": "KD",
        "MP": "MP", "MILJÖPARTIET DE GRÖNA": "MP", "MILJÖPARTIET": "MP",
        "L": "L", "LIBERALERNA (TIDIGARE FOLKPARTIET)": "L", "LIBERALERNA": "L"
    }

    # Extract 8-digit LKFV key from the 'Distrikt' column (e.g. 'RD-01-25-0904' -> '01250904')
    for _, row in df.iterrows():
        dist_str = str(row['Distrikt'])
        parts = dist_str.split('-')
        if len(parts) < 4:
            continue
        
        # 8-character district key matching GIS 'Lkfv'
        lkfv = parts[1] + parts[2] + parts[3]

        if lkfv not in vote_results:
            vote_results[lkfv] = {"S": 0, "M": 0, "SD": 0, "V": 0, "C": 0, "KD": 0, "MP": 0, "L": 0}

        raw_party = str(row[' Parti']).strip().upper()
        try:
            vote_count = int(row[' Röster'])
        except (ValueError, TypeError):
            vote_count = 0

        mapped = party_map.get(raw_party)
        if mapped:
            vote_results[lkfv][mapped] += vote_count

    print(f"[SUCCESS] Parsed accurate election data for {len(vote_results)} unique districts!")
    return vote_results


# 1. Load Excel Vote Data
vote_results = load_vote_data()

# 2. Process GIS Shapefiles
json_files = sorted(list(INPUT_DIR.glob("VD_*.json")))
geometries = []
properties_list = []
total_count = 0
matched_count = 0

print(f"[INFO] Merging results into {len(json_files)} GIS shapefiles...")

for file_path in json_files:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        raw_features = data if isinstance(data, list) else data.get("features", [data])

        for item in raw_features:
            if not isinstance(item, dict):
                continue

            geom_dict = item.get("geometry", item if "coordinates" in item else None)
            if geom_dict:
                try:
                    geom = shape(geom_dict)
                    geometries.append(geom)

                    props = item.get("properties", {k: v for k, v in item.items() if k != "geometry"}).copy()
                    
                    # Target 'Lkfv' key (e.g., '01250904')
                    lkfv_code = str(
                        props.get("Lkfv") or 
                        props.get("LKFV") or 
                        ""
                    ).strip()

                    votes = vote_results.get(lkfv_code)

                    if not votes:
                        votes = {"S": 0, "M": 0, "SD": 0, "V": 0, "C": 0, "KD": 0, "MP": 0, "L": 0}

                    if any(v > 0 for v in votes.values()):
                        matched_count += 1
                        winning_party = max(votes, key=votes.get)
                    else:
                        winning_party = "UNKNOWN"

                    props["feature_id"] = total_count
                    props["winning_party"] = winning_party
                    props["votes"] = votes
                    props["district_name"] = (
                        props.get("Vdnamn") or 
                        props.get("VDNAMN") or 
                        props.get("VD_NAMN") or 
                        f"District {total_count}"
                    )

                    properties_list.append(props)
                    total_count += 1
                except Exception:
                    pass

print(f"[INFO] Successfully linked votes to {matched_count} / {len(geometries)} total districts!")

# 3. Export WGS84 GeoJSON
gdf_polygons = gdf.GeoDataFrame(properties_list, geometry=geometries)
gdf_polygons.crs = "EPSG:3006"
gdf_wgs84 = gdf_polygons.to_crs(epsg=4326)
gdf_wgs84.to_file(OUTPUT_FILE, driver="GeoJSON")

print(f"[SUCCESS] Export complete! GeoJSON written to: {OUTPUT_FILE}")