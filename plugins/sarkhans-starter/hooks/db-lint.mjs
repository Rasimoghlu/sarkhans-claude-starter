import { loadConfig, readText } from "./lib.mjs";

const MONEY = /(price|amount|total|cost|balance|fee|salary|wage|tax|subtotal|discount|revenue|payment|budget|credit|debit)/i;
const EXTERNAL_ID = /^(stripe|paypal|braintree|google|github|gitlab|facebook|apple|twitter|slack|discord|auth0|firebase|external|provider|remote|oauth|session|request|trace|correlation|idempotency|device|push|message|job|batch)[_A-Z]/i;
const LIST_COLUMN = /(_ids|_list|Ids|List)$|^(tags|categories|roles|permissions|ids)$/;

export function schemaFormat(rel, text) {
  if (/\.prisma$/.test(rel)) return "prisma";
  if (/\.sql$/i.test(rel)) return "sql";
  if (/\.php$/.test(rel) && /Schema::(create|table)/.test(text)) return "laravel";
  if (/\.py$/.test(rel) && /\bop\.(create_table|add_column)|sa\.Column\(/.test(text)) return "alembic";
  if (/\.py$/.test(rel) && /models\.\w+Field\(|migrations\.(CreateModel|AddField)/.test(text)) return "django";
  if (/\.[cm]?[jt]s$/.test(rel) && /\b(pg|mysql|sqlite)Table\s*\(/.test(text)) return "drizzle";
  return null;
}

function dbEngine(text) {
  const docker = loadConfig().docker?.services?.db?.engine;
  if (docker) return docker;
  const envExample = readText(".env.example") + readText(".env.dist");
  const fromEnv = envExample.match(/^DB_CONNECTION=(\w+)/m)?.[1] || envExample.match(/^DATABASE_URL=["']?(\w+):/m)?.[1];
  const fromPrisma = text.match(/provider\s*=\s*"(postgresql|mysql|sqlite|sqlserver)"/)?.[1];
  const value = (fromPrisma || fromEnv || (/\bpgTable\b/.test(text) ? "postgres" : /\bmysqlTable\b/.test(text) ? "mysql" : "")).toLowerCase();
  if (/^(pgsql|postgres|postgresql|postgis)/.test(value)) return "postgres";
  if (/^(mysql|mariadb)/.test(value)) return "mysql";
  return value || "unknown";
}

const COLUMN_PATTERNS = {
  laravel: /->\s*(\w+)\(\s*['"](\w+)['"]/,
  sql: /^\s*["`]?(\w+)["`]?\s+(BIGINT|INT|INTEGER|SMALLINT|SERIAL|BIGSERIAL|UUID|CHAR|VARCHAR|TEXT|NUMERIC|DECIMAL|FLOAT|DOUBLE|REAL|JSONB?|BOOLEAN|DATE|TIMESTAMP\w*)\b/i,
  django: /^\s*(\w+)\s*=\s*models\.(\w+)\(/,
  alembic: /Column\(\s*['"](\w+)['"]\s*,\s*(?:sa\.)?(\w+)/,
  prisma: /^\s*(\w+)\s+(\w+)(\[\])?\??\s*(@|$)/,
  drizzle: /^\s*(\w+)\s*:\s*(\w+)\(/,
};

function columnOf(format, line) {
  const match = line.match(COLUMN_PATTERNS[format]);
  if (!match) return null;
  return format === "laravel" ? { type: match[1], name: match[2] } : { name: match[1], type: match[2] };
}

const FLOAT_TYPES = { laravel: /^(float|double|unsignedFloat|unsignedDouble)$/, sql: /^(FLOAT|DOUBLE|REAL)$/i, django: /^FloatField$/, alembic: /^(Float|REAL|Double)$/, prisma: /^Float$/, drizzle: /^(real|doublePrecision|float|double)$/ };
const ID_TYPES = { laravel: /^(unsignedBigInteger|bigInteger|integer|unsignedInteger|uuid|ulid|string|char)$/, sql: /./, django: /^(IntegerField|BigIntegerField|PositiveIntegerField|PositiveBigIntegerField|UUIDField|CharField)$/, alembic: /./, prisma: /^(Int|BigInt|String)$/, drizzle: /^(integer|bigint|uuid|text|varchar|serial|bigserial|int)$/ };
const LIST_TYPES = { laravel: /^(string|text|json|jsonb|longText)$/, sql: /^(VARCHAR|TEXT|JSONB?|CHAR)$/i, django: /^(CharField|TextField|JSONField)$/, alembic: /^(String|Text|JSON|JSONB)$/, prisma: /^(String|Json)$/, drizzle: /^(text|varchar|json|jsonb)$/ };

function hasForeignKey(format, name, line, fileText) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  switch (format) {
    case "laravel":
      return /->\s*(constrained|references)\(/.test(line) || new RegExp(`foreign\\(\\s*\\[?\\s*['"]${esc}['"]`).test(fileText);
    case "sql":
      return /\bREFERENCES\b/i.test(line) || new RegExp(`FOREIGN\\s+KEY\\s*\\(\\s*["\`]?${esc}\\b`, "i").test(fileText);
    case "django":
      return false;
    case "alembic":
      return /ForeignKey\(/.test(line) || new RegExp(`create_foreign_key\\([^)]*['"]${esc}['"]`).test(fileText);
    case "prisma":
      return new RegExp(`fields:\\s*\\[[^\\]]*\\b${esc}\\b`).test(fileText);
    case "drizzle":
      return /\.references\(/.test(line) || new RegExp(`foreignKey\\([\\s\\S]*?columns:\\s*\\[[^\\]]*\\b${esc}\\b`).test(fileText);
    default:
      return true;
  }
}

function hasIndex(format, name, line, fileText) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  switch (format) {
    case "laravel":
      return /->\s*(index|unique|primary)\(/.test(line) || new RegExp(`->\\s*(index|unique|primary)\\(\\s*\\[?\\s*['"]${esc}['"]`).test(fileText);
    case "sql":
      return new RegExp(`CREATE\\s+(UNIQUE\\s+)?INDEX[^;]*\\(\\s*["\`]?${esc}\\b`, "i").test(fileText) || new RegExp(`(PRIMARY\\s+KEY|UNIQUE)\\s*\\(\\s*["\`]?${esc}\\b`, "i").test(fileText) || /\b(PRIMARY\s+KEY|UNIQUE)\b/i.test(line);
    case "alembic":
      return /index\s*=\s*True|unique\s*=\s*True|primary_key\s*=\s*True/.test(line) || new RegExp(`create_index\\([^)]*['"]${esc}['"]`).test(fileText);
    case "prisma":
      return new RegExp(`@@(index|unique|id)\\(\\s*\\[\\s*${esc}\\b`).test(fileText) || /@unique|@id/.test(line);
    case "drizzle":
      return new RegExp(`\\.on\\([^)]*\\b${esc}\\b`).test(fileText) || /\.(unique|primaryKey)\(/.test(line);
    default:
      return true;
  }
}

export function schemaProblems(rel, written, fileText) {
  const format = schemaFormat(rel, fileText);
  if (!format) return [];
  const engine = dbEngine(fileText);
  const problems = [];
  const groups = new Map();

  for (const line of written.split(/\r?\n/)) {
    if (/^\s*(\/\/|#|--|\*)/.test(line)) continue;
    const column = columnOf(format, line);
    if (!column) continue;
    const { name, type } = column;
    if (["model", "enum", "datasource", "generator", "return"].includes(name)) continue;

    if (MONEY.test(name) && FLOAT_TYPES[format].test(type)) {
      problems.push([`Money column "${name}" uses a floating-point type (${type}). Use integer minor units (bigint cents) or DECIMAL(19,4).`, line]);
    }

    const isRefName = /(_id|[a-z]Id)$/.test(name) && !/^(id|uuid)$/i.test(name) && !EXTERNAL_ID.test(name);
    const isForeignHelper = format === "laravel" && /^foreign(Id|Uuid|Ulid|IdFor)$/.test(type);
    if (isRefName && (ID_TYPES[format].test(type) || isForeignHelper) && !hasForeignKey(format, name, line, fileText)) {
      const fix = {
        laravel: `$table->foreignId('${name}')->constrained()->restrictOnDelete()`,
        sql: `${name} BIGINT NOT NULL REFERENCES <table>(id) ON DELETE RESTRICT`,
        django: `${name.replace(/_id$/, "")} = models.ForeignKey(<Model>, on_delete=models.PROTECT)`,
        alembic: `sa.Column('${name}', sa.BigInteger, sa.ForeignKey('<table>.id', ondelete='RESTRICT'), nullable=False, index=True)`,
        prisma: `${name.replace(/Id$/, "")} <Model> @relation(fields: [${name}], references: [id], onDelete: Restrict)`,
        drizzle: `${name}: integer('${name}').notNull().references(() => <table>.id, { onDelete: 'restrict' })`,
      }[format];
      problems.push([`Reference column "${name}" has no foreign key constraint. Every *_id must be a real FK with explicit ON DELETE, e.g. ${fix}. (External IDs: use a name like stripe_customer_id with a UNIQUE constraint.)`, line]);
    } else if (isRefName && engine !== "mysql" && format !== "django" && hasForeignKey(format, name, line, fileText) && !hasIndex(format, name, line, fileText)) {
      problems.push([`Foreign key column "${name}" has no index${engine === "postgres" ? " — PostgreSQL does not index FKs automatically" : " (PostgreSQL/SQLite don't index FKs automatically)"}. Add an index (or make it part of a UNIQUE/PK).`, line]);
    }

    if (LIST_COLUMN.test(name) && LIST_TYPES[format].test(type)) {
      problems.push([`Column "${name}" stores a list in a single value — violates 1NF. Model it with a junction table (two FKs + composite PK/UNIQUE).`, line]);
    }

    const repeating = name.match(/^(\w+?)_?([1-9])$/);
    if (repeating) groups.set(repeating[1], (groups.get(repeating[1]) || 0) + 1);
  }

  for (const [base, count] of groups) {
    if (count >= 2) problems.push([`Repeating column group "${base}1, ${base}2, …" — violates 1NF. Move them to a child table (one row per value).`]);
  }
  return problems;
}
