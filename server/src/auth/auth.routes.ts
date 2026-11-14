
import type { FastifyInstance } from "fastify";

import {
  AuthError,
  registerUser,
  verifyEmail,
  loginUser,
  loginWithGoogle,
  logoutUser,
} from "./auth-service.js";

type RegisterBody = {
  username: string;
  email: string;
  password: string;
};

type LoginBody = {
  email: string;
  password: string;
};

type GoogleLoginBody = {
  credential: string;
};

type VerifyQuery = {
  token: string;
};

// Registracija svih ruta za autentifikaciju
export function registerAuthRoutes(app: FastifyInstance) {

  // Registracija novog korisnika
  app.post<{ Body: RegisterBody }>("/auth/register", async (request, reply) => {
    try {
      const { username, email, password } = request.body ?? {};

      if (
        typeof username !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        return reply.code(400).send({
          success: false,
          message: "Nedostaju obavezni podaci.",
        });
      }

      const result = await registerUser(username, email, password);
      return reply.code(201).send(result);

    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Došlo je do greške pri registraciji.",
      });
    }
  });

  // Potvrda e-mail adrese
  app.get<{ Querystring: VerifyQuery }>(
    "/auth/verify-email",
    async (request, reply) => {
      try {
        const result = await verifyEmail(request.query.token);
        return reply.send(result);

      } catch (error) {
        if (error instanceof AuthError) {
          return reply.code(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }

        request.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Greška pri potvrdi e-maila.",
        });
      }
    },
  );

  // Prijava korisnika
  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    try {
      const { email, password } = request.body ?? {};

      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        password.length === 0
      ) {
        return reply.code(400).send({
          success: false,
          message: "Unesi e-mail i lozinku.",
        });
      }

      const result = await loginUser(email, password);
      return reply.send(result);

    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Greška pri prijavi.",
      });
    }
  });

  app.post<{ Body: GoogleLoginBody }>("/auth/google", async (request, reply) => {
    try {
      const { credential } = request.body ?? {};

      if (typeof credential !== "string" || credential.length === 0) {
        return reply.code(400).send({
          success: false,
          message: "Google vjerodajnica nedostaje.",
        });
      }

      return reply.send(await loginWithGoogle(credential));
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Greška pri prijavi putem Googlea.",
      });
    }
  });

  // Odjava korisnika
  app.post("/auth/logout", async (request, reply) => {
    try {
      const authorization = request.headers.authorization;

      const sessionToken =
        authorization?.startsWith("Bearer ")
          ? authorization.slice(7)
          : "";

      const result = await logoutUser(sessionToken);
      return reply.send(result);

    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Greška pri odjavi.",
      });
    }
  });
}
