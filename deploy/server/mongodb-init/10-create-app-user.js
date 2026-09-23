const databaseName = process.env.MONGO_INITDB_DATABASE || "k12_agent";
const username = process.env.MONGO_APP_USERNAME || "k12agent";
const password = process.env.MONGO_APP_PASSWORD;

if (!password) {
  throw new Error("MONGO_APP_PASSWORD must be configured");
}

const applicationDatabase = db.getSiblingDB(databaseName);
if (!applicationDatabase.getUser(username)) {
  applicationDatabase.createUser({
    user: username,
    pwd: password,
    roles: [{ role: "readWrite", db: databaseName }],
  });
}

