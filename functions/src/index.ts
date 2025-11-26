import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import * as qs from "qs";

admin.initializeApp();
const db = admin.firestore();

// Prevent crash if a field is undefined (e.g. optional refresh_token)
db.settings({ ignoreUndefinedProperties: true });

// HARDCODED CONFIGURATION TO PREVENT MISMATCH ERRORS
const PROJECT_ID = "strategic-progress2";
const REGION = "us-central1";

// These URLs must match exactly what is in your Whoop Developer Dashboard
const AUTH_FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/whoopAuth`;
const CALLBACK_FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/whoopCallback`;

/**
 * 1. Start Auth Flow
 * Open this URL in browser to authorize the app.
 */
export const whoopAuth = functions.https.onRequest((req, res) => {
  const CLIENT_ID = functions.config().whoop.client_id;
  if (!CLIENT_ID) {
    res.status(500).send("Error: Configuration key 'whoop.client_id' is missing. Run firebase functions:config:set...");
    return;
  }

  // Generate a random state string > 8 chars (Whoop requirement)
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  // ADDED 'offline' scope to ensure we get a refresh_token
  const scope = "read:recovery read:cycles read:sleep read:workout offline";
  
  // Explicitly encode the Redirect URI to handle special characters correctly
  const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_FUNCTION_URL)}&scope=${scope}&state=${state}`;
  
  console.log("Starting Auth Flow, redirecting to:", authUrl);
  res.redirect(authUrl);
});

/**
 * 2. Callback Handler
 * Whoop redirects here with a code. We exchange it for tokens and save to DB.
 */
export const whoopCallback = functions.https.onRequest(async (req, res) => {
  console.log("Callback received. Query Params:", JSON.stringify(req.query));

  const code = req.query.code as string;
  const error = req.query.error as string;
  
  const CLIENT_ID = functions.config().whoop.client_id;
  const CLIENT_SECRET = functions.config().whoop.client_secret;

  // 1. Handle OAuth Errors sent by Whoop
  if (error) {
    res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: red;">Whoop Login Failed</h1>
          <p>Error code: <strong>${error}</strong></p>
          <p>${req.query.error_description || ''}</p>
          <a href="${AUTH_FUNCTION_URL}" style="display: inline-block; padding: 10px 20px; background: #333; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Try Again</a>
        </body>
      </html>
    `);
    return;
  }

  // 2. Handle Direct Visit (No code provided)
  if (!code) {
    res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background-color: #f3f4f6;">
          <div style="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
            <h1 style="color: #0f172a; margin-bottom: 10px;">Setup Required</h1>
            <p style="color: #64748b; mb-6;">You landed on the callback page without a login code.</p>
            <a href="${AUTH_FUNCTION_URL}" style="display: block; width: 100%; padding: 15px 0; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">Start Whoop Login</a>
          </div>
        </body>
      </html>
    `);
    return;
  }

  try {
    console.log("Exchanging code for token...");
    const tokenResponse = await axios.post(
      "https://api.prod.whoop.com/oauth/oauth2/token",
      qs.stringify({
        grant_type: "authorization_code",
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: CALLBACK_FUNCTION_URL,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    if (!refresh_token) {
        console.warn("WARNING: No refresh_token received from Whoop. Auto-sync will fail after 1 hour. Ensure 'offline' scope is requested.");
    }

    console.log("Token exchange successful. Saving to Firestore...");
    // Save tokens securely
    // ignoreUndefinedProperties is enabled above, so if refresh_token is missing it won't crash, 
    // but sync will eventually fail.
    await db.collection("config").doc("whoop_tokens").set({
      accessToken: access_token,
      refreshToken: refresh_token, 
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expires_in * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Use absolute URL for the trigger link
    const TRIGGER_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/triggerWhoopSync`;

    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background-color: #ecfdf5; color: #064e3b;">
          <h1 style="color: #059669;">Connection Successful!</h1>
          <p>Whoop account linked. You can now fetch your data.</p>
          <div style="margin-top: 30px;">
            <a href="${TRIGGER_URL}" target="_blank" style="background-color: #10b981; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Fetch Data Now</a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">You can also close this window and use the 'Sync Data' button in your dashboard.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Auth Token Exchange Error:", error.response?.data || error.message);
    res.status(500).send(`
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>Failed to exchange code for token.</p>
          <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
        </body>
      </html>
    `);
  }
});

/**
 * Helper: Get valid Access Token (Refresh if needed)
 */
async function getAccessToken() {
  const doc = await db.collection("config").doc("whoop_tokens").get();
  if (!doc.exists) throw new Error("No tokens found. Authenticate first via whoopAuth.");

  const data = doc.data()!;
  const now = Date.now();
  
  // Check if token is expired or close to expiring (within 5 minutes)
  if (data.expiresAt.toMillis() < now + 5 * 60 * 1000) {
    console.log("Token expired or expiring soon. Refreshing...");
    
    if (!data.refreshToken) {
        throw new Error("Cannot refresh token: No refresh_token found in DB. Please re-authenticate manually.");
    }

    const CLIENT_ID = functions.config().whoop.client_id;
    const CLIENT_SECRET = functions.config().whoop.client_secret;

    try {
        const response = await axios.post(
        "https://api.prod.whoop.com/oauth/oauth2/token",
        qs.stringify({
            grant_type: "refresh_token",
            refresh_token: data.refreshToken,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        
        const { access_token, refresh_token, expires_in } = response.data;
        
        // Update DB with new tokens
        await db.collection("config").doc("whoop_tokens").set({
          accessToken: access_token,
          // Only update refresh_token if a new one was sent back (some flows rotate it, some don't)
          refreshToken: refresh_token || data.refreshToken,
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + expires_in * 1000),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        
        return access_token;
    } catch (e: any) {
        console.error("Token Refresh Failed", e.response?.data || e.message);
        throw new Error("Token refresh failed. Re-authenticate.");
    }
  }

  return data.accessToken;
}

/**
 * 3. Fetch Data (Scheduled)
 * Runs automatically to pull data.
 */
export const scheduledWhoopFetch = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    await syncWhoopData();
});

/**
 * 4. Fetch Data (Manual Trigger via HTTP)
 * Useful for debugging or force sync.
 * ENABLED CORS for client-side usage.
 */
export const triggerWhoopSync = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    try {
        await syncWhoopData();
        res.send("Sync completed successfully. Go back to your dashboard and refresh.");
    } catch (e: any) {
        console.error(e);
        res.status(500).send("Sync failed: " + e.message);
    }
});

async function syncWhoopData() {
    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log("Fetching Whoop data...");
        // Using Promise.all to fetch distinct resources in parallel
        const [recoveryRes, cycleRes, sleepRes] = await Promise.all([
            axios.get("https://api.prod.whoop.com/developer/v1/recovery?limit=25", { headers }),
            axios.get("https://api.prod.whoop.com/developer/v1/cycle?limit=25", { headers }),
            axios.get("https://api.prod.whoop.com/developer/v1/sleep?limit=25", { headers })
        ]);

        const recoveries = recoveryRes.data.records || [];
        const cycles = cycleRes.data.records || [];
        const sleeps = sleepRes.data.records || [];

        console.log(`Fetched: ${recoveries.length} recoveries, ${cycles.length} cycles, ${sleeps.length} sleeps`);

        const batch = db.batch();
        const metricsMap: Record<string, any> = {};

        // Helper to normalize date strings found in different Whoop endpoints
        const getDateStr = (isoString: string) => isoString ? isoString.split('T')[0] : null;

        // 1. Process Recoveries
        for (const rec of recoveries) {
            // Whoop usually provides 'date' field in YYYY-MM-DD for recovery
            const date = rec.date || getDateStr(rec.created_at);
            if (!date) continue;

            if (!metricsMap[date]) metricsMap[date] = { date: admin.firestore.Timestamp.fromDate(new Date(date)) };
            
            if (rec.score) {
                metricsMap[date].recovery = rec.score.recovery_score;
                metricsMap[date].hrv = rec.score.hrv_rmssd_milli;
                metricsMap[date].restingHeartRate = rec.score.resting_heart_rate;
            }
        }

        // 2. Process Cycles (Strain)
        for (const cyc of cycles) {
            // Cycles use 'start' or 'created_at'
            const date = getDateStr(cyc.start || cyc.created_at);
            if (!date) continue;

            if (!metricsMap[date]) metricsMap[date] = { date: admin.firestore.Timestamp.fromDate(new Date(date)) };
            
            if (cyc.score) {
                metricsMap[date].strain = cyc.score.strain;
                metricsMap[date].calories = cyc.score.kilojoule; 
            }
        }

        // 3. Process Sleep
        for (const slp of sleeps) {
            // Sleep relates to the 'start' of the sleep
            const date = getDateStr(slp.start || slp.created_at);
            if (!date) continue;

             if (!metricsMap[date]) metricsMap[date] = { date: admin.firestore.Timestamp.fromDate(new Date(date)) };
             
             if (slp.score) {
                metricsMap[date].sleepPerformance = slp.score.sleep_performance_percentage;
                metricsMap[date].sleepEfficiency = slp.score.sleep_efficiency_percentage;
             }
        }

        // Write merged data to Firestore
        let count = 0;
        for (const [dateStr, data] of Object.entries(metricsMap)) {
            // Simple validation to ensure we aren't writing empty docs
            if (data.recovery !== undefined || data.strain !== undefined || data.sleepPerformance !== undefined) {
                const docRef = db.collection("health_metrics").doc(dateStr);
                batch.set(docRef, { ...data, lastUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        console.log(`Whoop data synced successfully. Updated/Created ${count} documents.`);
    } catch (error: any) {
        console.error("Sync Error Details:", error.response?.data || error.message);
        throw error;
    }
}
