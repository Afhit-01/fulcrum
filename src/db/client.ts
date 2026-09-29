import {env} from "../config/env.js"
import { Pool } from "pg";


const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
});

export default pool;
