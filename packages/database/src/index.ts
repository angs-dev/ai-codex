import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./schema.js";
export { MIGRATIONS } from "./schema.js";
export class Swing10Database {
 readonly connection: DatabaseSync;
 constructor(path: string) { this.connection=new DatabaseSync(path); this.connection.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;"); }
 migrate():void {
  this.connection.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const applied=this.connection.prepare("SELECT 1 FROM schema_migrations WHERE version=?");
  const record=this.connection.prepare("INSERT INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)");
  for(const m of MIGRATIONS) if(!applied.get(m.version)) { this.connection.exec("BEGIN IMMEDIATE"); try { this.connection.exec(m.sql); record.run(m.version,m.name,new Date().toISOString()); this.connection.exec("COMMIT"); } catch(error) { this.connection.exec("ROLLBACK"); throw error; } }
 }
 close():void { this.connection.close(); }
}
