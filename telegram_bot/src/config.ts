import * as dotenv from 'dotenv'; 
import * as path from 'path';


dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const BOT_TOKEN = process.env.BOT_TOKEN || "";
export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
    console.log("Supabase url is .....", SUPABASE_URL);
    console.log("Supabase key is .....", SUPABASE_KEY);
    console.error("🚨 ERROR: Missing environment variables!");
    process.exit(1);
}