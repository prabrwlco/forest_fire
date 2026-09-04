

from flask import Flask, request, jsonify, render_template
import requests
import json, csv
from alert import dispatch_nearest_authority_alert

import config
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html", bbox=config.NEPAL_BBOX)

@app.route("/api/communities")
def get_communities():
    with open("data/communities.json","r") as f:
        data = json.load(f)
    return jsonify(data)

@app.route("/api/hotspots")
def api_hotspots():
    source = request.args.get("source", getattr(config, "FIRMS_SOURCE", "VIIRS_NOAA21_NRT"))
    days = request.args.get("days", "1")
    target_bbox = request.args.get("bbox", config.NEPAL_BBOX)
    
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{config.FIRMS_MAP_KEY}/{source}/{target_bbox}/{days}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            print("error")
            return jsonify([])

        reader = csv.DictReader(response.text.strip().splitlines())
        hotspots = []
        
        for row in reader:
            try:
                
                raw_conf = row.get("confidence", "n").lower()
                
                if raw_conf in ["l", "low"] or (raw_conf.isdigit() and int(raw_conf) < 40):
                    confidence = "low"
                elif raw_conf in ["h", "high"] or (raw_conf.isdigit() and int(raw_conf) >= 80):
                    confidence = "high"
                else:
                    confidence = "nominal"

                hotspots.append({
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "frp": float(row["frp"]),
                "confidence": confidence,
                "date": row["acq_date"],
                "time": row["acq_time"]
            })
            except (ValueError, KeyError):
                continue
        
        # Print requested FIRMS hotspot data to the terminal
        print("\n--- FIRMS API Hotspot Data Received ---")
        print(f"Total Hotspots Found: {len(hotspots)}")
        print(json.dumps(hotspots, indent=2))
        print("----------------------------------------\n")
        return jsonify(hotspots)
    except Exception as e:
        print(f"[Error fetching FIRMS]: {e}")
        return jsonify([])
@app.route("/api/send-alert")
def send_alert():
    data=request.json() or{}
    fires=data.get("fires",[])
    communities=data.get("communities",[])
    response=dispatch_nearest_authority_alert(fires, communities)
    status_code = 200 if response.get("status") == "success" else 400
    return jsonify(response), status_code


if __name__ == "__main__":
    app.run(host=config.FLASK_HOST, port=int(config.FLASK_PORT), debug=config.DEBUG_MODE)
