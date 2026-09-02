// .............no use...activeBreachingFires..
const defaultBBox = window.APP_CONFIG.bbox;

const bboxCoords = defaultBBox.split(',').map(Number);



//CREATE THE LEAFLET MAP

const map = L.map('map').fitBounds([
    [bboxCoords[1], bboxCoords[0]], // South-West: latitude, longitude
    [bboxCoords[3], bboxCoords[2]]  // North-East: latitude, longitude
]);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,

    attribution: '© OpenStreetMap contributors'
}).addTo(map);


// CREATE LAYER GROUPS AND VARIABLES

const markerGroup = L.layerGroup().addTo(map);

// Fires that are inside the Geo-Fence will be stored here.
const geoFenceMatchesGroup = L.layerGroup().addTo(map);

// Heatmap starts as null because it has not been created yet.
let heatLayer = null;

// Store all fire hotspot data received from Flask.
let currentHotspots = [];

// Store community/authority information.
let communitiesData = [];

// Store fires that are currently inside the Geo-Fence.
let activeBreachingFires = [];



//LEAFLET DRAW SETUP

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);


// Create the drawing toolbar.
const drawControl = new L.Control.Draw({

    draw: {

        // Allow the user to draw polygons.
        polygon: {
            shapeOptions: {
                color: '#dc3545',
                fillColor: '#dc3545',
                fillOpacity: 0.15,
                weight: 2
            }
        },

        // Allow the user to draw circles.
        circle: {
            shapeOptions: {
                color: '#dc3545',
                fillColor: '#dc3545',
                fillOpacity: 0.15,
                weight: 2
            }
        },

        // Allow the user to draw rectangles.
        rectangle: {
            shapeOptions: {
                color: '#dc3545',
                fillColor: '#dc3545',
                fillOpacity: 0.15,
                weight: 2
            }
        },

        // Disable drawing polylines.
        polyline: false,

        // Disable drawing individual markers.
        marker: false,

        // Disable circle markers.
        circlemarker: false
    },

    // Allow previously drawn shapes to be edited.
    edit: {
        featureGroup: drawnItems
    }
});

// Add the drawing toolbar to the map.
map.addControl(drawControl);


// GET BOUNDING BOX FROM A DRAWN SHAPE

function getLayerBBox(layer) {

    // If there is no layer, return null.
    if (!layer) return null;
    const bounds = layer.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return `${sw.lng.toFixed(4)},${sw.lat.toFixed(4)},${ne.lng.toFixed(4)},${ne.lat.toFixed(4)}`;
}


// ============================================================
// 7. CHECK IF A POINT IS INSIDE A POLYGON
// ============================================================

// This uses the Ray-Casting algorithm.
//
// It checks whether a fire location is inside
// a polygon drawn by the user.
function isPointInPolygon(point, vs) {

    // Get latitude and longitude of the fire.
    let x = point.lat;
    let y = point.lng;

    // Initially assume the point is outside.
    let inside = false;

    // Go through every polygon edge.
    for (
        let i = 0, j = vs.length - 1;
        i < vs.length;
        j = i++
    ) {

        // Coordinates of the current polygon point.
        let xi = vs[i].lat;
        let yi = vs[i].lng;

        // Coordinates of the previous polygon point.
        let xj = vs[j].lat;
        let yj = vs[j].lng;

        // Check whether the horizontal ray from the point
        // crosses this polygon edge.
        let intersect =
            ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        // Every intersection changes inside -> outside
        // or outside -> inside.
        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}


// ============================================================
// 8. CHECK GEO-FENCE
// ============================================================

function checkGeofences() {

    // Remove old Geo-Fence fire markers.
    geoFenceMatchesGroup.clearLayers();

    // Start with no detected breaches.
    activeBreachingFires = [];


    // Check every shape drawn on the map.
    drawnItems.eachLayer(zone => {

        // Check every fire hotspot.
        currentHotspots.forEach(h => {

            // Convert fire coordinates into a Leaflet LatLng.
            const firePt = L.latLng(
                h.latitude,
                h.longitude
            );

            let isInside = false;


            // ------------------------------------------------
            // If the Geo-Fence is a circle
            // ------------------------------------------------
            if (zone instanceof L.Circle) {

                // Calculate distance between:
                // circle center -> fire
                //
                // If distance is less than or equal to
                // circle radius, the fire is inside.
                if (
                    zone.getLatLng().distanceTo(firePt)
                    <= zone.getRadius()
                ) {
                    isInside = true;
                }
            }


            // ------------------------------------------------
            // If the Geo-Fence is a polygon
            // ------------------------------------------------
            else if (zone instanceof L.Polygon) {

                // Check whether the fire is inside the polygon.
                if (
                    isPointInPolygon(
                        firePt,
                        zone.getLatLngs()[0]
                    )
                ) {
                    isInside = true;
                }
            }


            // ------------------------------------------------
            // If fire is inside the Geo-Fence
            // ------------------------------------------------
            if (isInside) {

                // Save this fire in the active breach list.
                activeBreachingFires.push(h);


                // Create a red circle marker.
                L.circleMarker(firePt, {
                    radius: 9,
                    color: '#721c24',
                    fillColor: '#ff0000',
                    fillOpacity: 1,
                    weight: 2
                })

                // Information shown when the marker is clicked.
                .bindPopup(`
                    <div style="color: #721c24;">
                        <strong>🚨 GEOFENCE BREACH DETECTED</strong><br>

                        <strong>FRP:</strong>
                        ${h.frp} MW<br>

                        <strong>Confidence:</strong>
                        ${h.confidence.toUpperCase()}<br>

                        <strong>Time:</strong>
                        ${h.time}
                    </div>
                `)

                // Add marker to the Geo-Fence layer.
                .addTo(geoFenceMatchesGroup);
            }
        });
    });


    // ========================================================
    // UPDATE GEO-FENCE ALERT UI
    // ========================================================

    const alertBanner =
        document.getElementById('geoFenceAlert');

    const alertMsg =
        document.getElementById('alertMessage');

    const statusBox =
        document.getElementById('dispatchStatus');


    // If there are fires inside the zone...
    if (activeBreachingFires.length > 0) {

        // Show the alert banner.
        alertBanner.classList.add('active');

        // Show number of fires detected.
        alertMsg.innerHTML =
            `<span class="alert-count">
                ${activeBreachingFires.length}
            </span>
            active fire(s) detected inside your zone!`;
    }

    // If there are no fires...
    else {

        // Hide the alert banner.
        alertBanner.classList.remove('active');

        // Hide dispatch status.
        statusBox.style.display = 'none';
    }
}


// ============================================================
// 9. WHEN A NEW SHAPE IS CREATED
// ============================================================

map.on(L.Draw.Event.CREATED, function (e) {

    // Remove the previous Geo-Fence.
    drawnItems.clearLayers();

    // Get the newly created shape.
    const layer = e.layer;

    // Add the shape to our FeatureGroup.
    drawnItems.addLayer(layer);

    // Load fire data only inside the new area.
    loadHotspots(getLayerBBox(layer));
});


// ============================================================
// 10. WHEN A SHAPE IS EDITED
// ============================================================

map.on(L.Draw.Event.EDITED, function () {

    // Get all drawn shapes.
    const layers = drawnItems.getLayers();

    // If a shape exists, reload fire data.
    if (layers.length > 0) {
        loadHotspots(getLayerBBox(layers[0]));
    }
});


// ============================================================
// 11. WHEN A SHAPE IS DELETED
// ============================================================

map.on(L.Draw.Event.DELETED, function () {

    // Load hotspots for the default Nepal BBOX again.
    loadHotspots();
});


// ============================================================
// 12. LOAD COMMUNITY/AUTHORITY LOCATIONS

fetch('/api/communities')

    // Convert Flask's JSON response into JavaScript data.
    .then(res => res.json())

    .then(data => {

        // Save the data.
        communitiesData = data;

        // Go through every community.
        data.forEach(c => {

            // Make sure latitude and longitude exist.
            if (c.latitude && c.longitude) {

                // Create a marker for the community.
                L.marker([
                    c.latitude,
                    c.longitude
                ])

                // Popup information.
                .bindPopup(`
                    <strong>${c.name}</strong><br>
                    District: ${c.district}<br>
                    Email: ${c.email}
                `)

                // Add marker to map.
                .addTo(map);
            }
        });
    })

    // Show an error if the request fails.
    .catch(err => {
        console.error(
            'Error loading communities:',
            err
        );
    });


// ============================================================
// 13. GET COLOR BASED ON FIRE CONFIDENCE
// ============================================================

function getConfidenceColor(conf) {

    switch (conf) {

        // High confidence = red
        case 'high':
            return '#d9534f';

        // Nominal confidence = orange
        case 'nominal':
            return '#f0ad4e';

        // Low confidence = blue
        case 'low':
            return '#5bc0de';

        // Default = orange
        default:
            return '#f0ad4e';
    }
}


// ============================================================
// 14. LOAD FIRE HOTSPOTS FROM FLASK
// ============================================================

function loadHotspots(targetBBox = null) {

    // Get selected satellite from HTML.
    const source =
        document.getElementById('satellite').value;

    // Get selected number of days.
    const days =
        document.getElementById('timeRange').value;


    // Create URL for our Flask API.
    let queryUrl =
        `/api/hotspots?source=${source}&days=${days}`;


    // If user drew a Geo-Fence,
    // add its BBOX to the API request.
    if (targetBBox) {
        queryUrl += `&bbox=${targetBBox}`;
    }


    // Ask Flask for hotspot data.
    fetch(queryUrl)

        // Convert response to JSON.
        .then(res => res.json())

        .then(hotspots => {

            // Save the received hotspots.
            currentHotspots = hotspots;

            // Remove old fire markers.
            markerGroup.clearLayers();

            // Remove old heatmap.
            if (heatLayer) {
                map.removeLayer(heatLayer);
            }


            // Array for heatmap coordinates.
            const heatPoints = [];


            // Go through every fire.
            hotspots.forEach(h => {

                // Fire location.
                const latLng = [
                    h.latitude,
                    h.longitude
                ];


                // Calculate marker size from FRP.
                //
                // Higher FRP = larger marker.
                const radius = Math.max(
                    4,
                    Math.min(
                        Math.sqrt(h.frp) * 2.5,
                        20
                    )
                );


                // Get marker color from confidence.
                const color =
                    getConfidenceColor(h.confidence);


                // Create fire marker.
                L.circleMarker(latLng, {
                    radius: radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.75,
                    weight: 1
                })

                // Fire information popup.
                .bindPopup(`
                    <strong>🔥 Fire Hotspot</strong><br>
                    FRP: ${h.frp} MW<br>
                    Confidence:
                    ${h.confidence.toUpperCase()}<br>
                    Acq Time: ${h.time}
                `)

                // Add fire marker to map.
                .addTo(markerGroup);


                // Add fire to heatmap.
                //
                // Third value controls heat intensity.
                heatPoints.push([
                    h.latitude,
                    h.longitude,
                    Math.min(h.frp / 50, 1.0)
                ]);
            });


            // =================================================
            // CREATE HEATMAP
            // =================================================

            heatLayer = L.heatLayer(
                heatPoints,
                {
                    radius: 25,
                    blur: 15,
                    maxZoom: 12,

                    // Heatmap color gradient.
                    gradient: {
                        0.2: 'blue',
                        0.4: 'cyan',
                        0.6: 'lime',
                        0.8: 'yellow',
                        1.0: 'red'
                    }
                }
            );


            // Only display heatmap if checkbox is checked.
            if (
                document.getElementById('toggleHeatmap').checked
            ) {
                heatLayer.addTo(map);
            }


            // Check whether any fires entered the Geo-Fence.
            checkGeofences();
        })

        // If API request fails.
        .catch(err => {
            console.error(
                'Error loading hotspots:',
                err
            );
        });
}


// ============================================================
// 15. SEND ALERT BUTTON
// ============================================================

// Find the Send Alert button.
document
    .getElementById('sendAlertBtn')
    .addEventListener('click', () => {


        // If there are no fires inside the Geo-Fence,
        // don't send an alert.
        if (activeBreachingFires.length === 0) {

            alert(
                "No active fires detected in the Geo-Fence zone to report."
            );

            return;
        }


        // Get button and status elements.
        const btn =
            document.getElementById('sendAlertBtn');

        const statusBox =
            document.getElementById('dispatchStatus');


        // Disable button while processing.
        btn.disabled = true;

        btn.innerText =
            "Finding Nearest Authority...";

        // Show status box.
        statusBox.style.display = "block";

        statusBox.innerHTML =
            "⏳ Calculating distance & sending email...";


        // Send fire and community data to Flask.
        fetch('/api/send-alert', {

            // This is a POST request.
            method: 'POST',

            // Tell Flask that we are sending JSON.
            headers: {
                'Content-Type': 'application/json'
            },

            // Convert JavaScript object into JSON.
            body: JSON.stringify({
                fires: activeBreachingFires,
                communities: communitiesData
            })
        })

        // Convert Flask response into JSON.
        .then(res => res.json())

        .then(resData => {

            // Check whether Flask successfully sent alert.
            if (
                resData.status === "success" &&
                resData.recipient
            ) {

                const r = resData.recipient;

                // Display recipient information.
                statusBox.innerHTML = `
                    <strong>
                        ✅ Alert Sent to Nearest Authority:
                    </strong><br>

                    <strong>${r.name}</strong>
                    (${r.district})<br>

                    📏 Distance:
                    <strong>${r.distance_km} km away</strong><br>

                    📧 ${r.email}
                `;
            }

            else {

                // Display failure message.
                statusBox.innerHTML =
                    `<span style="color: #ffc107;">
                        ❌ Failed: ${resData.message}
                    </span>`;
            }
        })

        // Handle network/API errors.
        .catch(err => {

            statusBox.innerHTML =
                `<span style="color: #ffc107;">
                    ❌ Dispatch Error: ${err}
                </span>`;
        })

        // This runs whether request succeeds or fails.
        .finally(() => {

            // Enable button again.
            btn.disabled = false;

            // Restore button text.
            btn.innerText =
                "📧 Resend Alert to Nearest Authority";
        });
    });


// ============================================================
// 16. SATELLITE SELECTOR
// ============================================================

document
    .getElementById('satellite')
    .addEventListener('change', () => {

        // Check if user has drawn a Geo-Fence.
        const layers = drawnItems.getLayers();

        // Reload hotspots using selected satellite.
        loadHotspots(
            layers.length > 0
                ? getLayerBBox(layers[0])
                : null
        );
    });


// ============================================================
// 17. TIME RANGE SELECTOR
// ============================================================

document
    .getElementById('timeRange')
    .addEventListener('change', () => {

        // Get drawn Geo-Fence.
        const layers = drawnItems.getLayers();

        // Reload hotspots using selected time range.
        loadHotspots(
            layers.length > 0
                ? getLayerBBox(layers[0])
                : null
        );
    });


// ============================================================
// 18. HEATMAP TOGGLE
// ============================================================

document
    .getElementById('toggleHeatmap')
    .addEventListener('change', (e) => {

        // Only do something if heatmap exists.
        if (heatLayer) {

            // If checkbox is checked -> show heatmap.
            if (e.target.checked) {
                heatLayer.addTo(map);
            }

            // If checkbox is unchecked -> remove heatmap.
            else {
                map.removeLayer(heatLayer);
            }
        }
    });


loadHotspots();