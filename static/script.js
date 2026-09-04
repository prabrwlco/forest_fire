
const bboxCoords = defaultBBox.split(',').map(Number);
const map = L.map('map').fitBounds([[bboxCoords[1], bboxCoords[0]], [bboxCoords[3], bboxCoords[2]]]);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

const markerGroup = L.layerGroup().addTo(map);
const geoFenceMatchesGroup = L.layerGroup().addTo(map);
let heatLayer = null;
let currentHotspots = [];
let communitiesData = [];
let activeBreachingFires = [];

// Leaflet.draw Toolbar Setup
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
    draw: {
        polygon: { shapeOptions: { color: '#dc3545', fillColor: '#dc3545', fillOpacity: 0.15, weight: 2 } },
        circle: { shapeOptions: { color: '#dc3545', fillColor: '#dc3545', fillOpacity: 0.15, weight: 2 } },
        rectangle: { shapeOptions: { color: '#dc3545', fillColor: '#dc3545', fillOpacity: 0.15, weight: 2 } },
        polyline: false,
        marker: false,
        circlemarker: false
    },
    edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

function getLayerBBox(layer) {
    if (!layer) return null;
    const bounds = layer.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return `${sw.lng.toFixed(4)},${sw.lat.toFixed(4)},${ne.lng.toFixed(4)},${ne.lat.toFixed(4)}`;
}

// Ray-casting algorithm for checking if a point is inside a polygon
function isPointInPolygon(point, vs) {
    let x = point.lat, y = point.lng;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].lat, yi = vs[i].lng;
        let xj = vs[j].lat, yj = vs[j].lng;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function checkGeofences() {
    geoFenceMatchesGroup.clearLayers();
    activeBreachingFires = [];

    drawnItems.eachLayer(zone => {
        currentHotspots.forEach(h => {
            const firePt = L.latLng(h.latitude, h.longitude);
            let isInside = false;

            if (zone instanceof L.Circle) {
                if (zone.getLatLng().distanceTo(firePt) <= zone.getRadius()) isInside = true;
            } else if (zone instanceof L.Polygon) {
                if (isPointInPolygon(firePt, zone.getLatLngs()[0])) isInside = true;
            }

            if (isInside) {
                activeBreachingFires.push(h);
                L.circleMarker(firePt, {
                    radius: 9,
                    color: '#721c24',
                    fillColor: '#ff0000',
                    fillOpacity: 1,
                    weight: 2
                })
                .bindPopup(`
                    <div style="color: #721c24;">
                        <strong>🚨 GEOFENCE BREACH DETECTED</strong><br>
                        <strong>FRP:</strong> ${h.frp} MW<br>
                        <strong>Confidence:</strong> ${h.confidence.toUpperCase()}<br>
                        <strong>Time:</strong> ${h.acq_time}
                    </div>
                `)
                .addTo(geoFenceMatchesGroup);
            }
        });
    });

    const alertBanner = document.getElementById('geoFenceAlert');
    const alertMsg = document.getElementById('alertMessage');
    const statusBox = document.getElementById('dispatchStatus');

    if (activeBreachingFires.length > 0) {
        alertBanner.classList.add('active');
        alertMsg.innerHTML = `<span class="alert-count">${activeBreachingFires.length}</span> active fire(s) detected inside your zone!`;
    } else {
        alertBanner.classList.remove('active');
        statusBox.style.display = 'none';
    }
}

// Leaflet Draw Event Listeners
map.on(L.Draw.Event.CREATED, function (e) {
    drawnItems.clearLayers();
    const layer = e.layer;
    drawnItems.addLayer(layer);
    loadHotspots(getLayerBBox(layer));
});

map.on(L.Draw.Event.EDITED, function () {
    const layers = drawnItems.getLayers();
    if (layers.length > 0) loadHotspots(getLayerBBox(layers[0]));
});

map.on(L.Draw.Event.DELETED, function () {
    loadHotspots();
});

// Fetch Community & Authority Station Locations
fetch('/api/communities')
    .then(res => res.json())
    .then(data => {
        communitiesData = data;
        data.forEach(c => {
            if (c.latitude && c.longitude) {
                L.marker([c.latitude, c.longitude])
                .bindPopup(`<strong>${c.name}</strong><br>District: ${c.district}<br>Email: ${c.email}`)
                .addTo(map);
            }
        });
    });

function getConfidenceColor(conf) {
    switch(conf) {
        case 'high': return '#d9534f';
        case 'nominal': return '#f0ad4e';
        case 'low': return '#5bc0de';
        default: return '#f0ad4e';
    }
}

function loadHotspots(targetBBox = null) {
    const source = document.getElementById('satellite').value;
    const days = document.getElementById('timeRange').value;

    let queryUrl = `/api/hotspots?source=${source}&days=${days}`;
    if (targetBBox) queryUrl += `&bbox=${targetBBox}`;

    fetch(queryUrl)
        .then(res => res.json())
        .then(hotspots => {
            currentHotspots = hotspots;
            markerGroup.clearLayers();
            if (heatLayer) map.removeLayer(heatLayer);

            const heatPoints = [];

            hotspots.forEach(h => {
                const latLng = [h.latitude, h.longitude];
                const radius = Math.max(4, Math.min(Math.sqrt(h.frp) * 2.5, 20));
                const color = getConfidenceColor(h.confidence);

                L.circleMarker(latLng, {
                    radius: radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.75,
                    weight: 1
                })
                .bindPopup(`
                    <strong>🔥 Fire Hotspot</strong><br>
                    FRP: ${h.frp} MW<br>
                    Confidence: ${h.confidence.toUpperCase()}<br>
                    Acq Time: ${h.acq_time}
                `)
                .addTo(markerGroup);

                heatPoints.push([h.latitude, h.longitude, Math.min(h.frp / 50, 1.0)]);
            });

            heatLayer = L.heatLayer(heatPoints, { 
                radius: 25, 
                blur: 15, 
                maxZoom: 12,
                gradient: { 0.2: 'blue', 0.4: 'cyan', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' }
            });

            if (document.getElementById('toggleHeatmap').checked) {
                heatLayer.addTo(map);
            }

            checkGeofences();
        });
}

// Dispatch Email Trigger to Nearest Authority Only
document.getElementById('sendAlertBtn').addEventListener('click', () => {
    if (activeBreachingFires.length === 0) {
        alert("No active fires detected in the Geo-Fence zone to report.");
        return;
    }

    const btn = document.getElementById('sendAlertBtn');
    const statusBox = document.getElementById('dispatchStatus');
    
    btn.disabled = true;
    btn.innerText = "Finding Nearest Authority...";
    statusBox.style.display = "block";
    statusBox.innerHTML = "⏳ Calculating distance & sending email...";

    fetch('/api/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fires: activeBreachingFires,
            communities: communitiesData
        })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success" && resData.recipient) {
            const r = resData.recipient;
            statusBox.innerHTML = `
                <strong>✅ Alert Sent to Nearest Authority:</strong><br>
                <strong>${r.name}</strong> (${r.district})<br>
                📏 Distance: <strong>${r.distance_km} km away</strong><br>
                📧 ${r.email}
            `;
        } else {
            statusBox.innerHTML = `<span style="color: #ffc107;">❌ Failed: ${resData.message}</span>`;
        }
    })
    .catch(err => {
        statusBox.innerHTML = `<span style="color: #ffc107;">❌ Dispatch Error: ${err}</span>`;
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "📧 Resend Alert to Nearest Authority";
    });
});

// Event Listeners for Controls
document.getElementById('satellite').addEventListener('change', () => {
    const layers = drawnItems.getLayers();
    loadHotspots(layers.length > 0 ? getLayerBBox(layers[0]) : null);
});

document.getElementById('timeRange').addEventListener('change', () => {
    const layers = drawnItems.getLayers();
    loadHotspots(layers.length > 0 ? getLayerBBox(layers[0]) : null);
});

document.getElementById('toggleHeatmap').addEventListener('change', (e) => {
    if (heatLayer) {
        e.target.checked ? heatLayer.addTo(map) : map.removeLayer(heatLayer);
    }
});

loadHotspots();