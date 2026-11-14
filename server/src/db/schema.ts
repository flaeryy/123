import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  boolean,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Postojeći korisnici i njihova statistika
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  rating: integer("rating").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
});

// Korisnički računi za prijavu
export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull().unique(),
    passwordHash: text("password_hash"),
    googleId: varchar("google_id", { length: 255 }).unique(),
    emailVerifiedAt: timestamp("email_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("accounts_user_id_unique").on(table.userId),
  ],
);

// Jednokratni tokeni za potvrdu email adrese
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Aktivne korisničke sesije
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Postojeće partije
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 8 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("waiting"),
  maxPlayers: integer("max_players").notNull().default(4),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  minRating: integer("min_rating").notNull().default(0),

  finishedAt: timestamp("finished_at"),
  team1Score: integer("team1_score"),
  team2Score: integer("team2_score"),
  callingTeam: integer("calling_team"),
  contractMade: boolean("contract_made"),
  declarationPoints: integer("declaration_points"),
  team1Bela: integer("team1_bela"),
  team2Bela: integer("team2_bela"),
});

// Poruke iz chat-a po sobi, zadržane i nakon što partija započne
export const roomMessages = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomCode: varchar("room_code", { length: 8 }).notNull(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  username: varchar("username", { length: 30 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Igrači koji sudjeluju u pojedinoj partiji
export const gamePlayers = pgTable(
  "game_players",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seat: integer("seat").notNull(),
    isHost: boolean("is_host").notNull().default(false),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("game_player_unique").on(table.gameId, table.userId),
    uniqueIndex("game_seat_unique").on(table.gameId, table.seat),
  ],
);
