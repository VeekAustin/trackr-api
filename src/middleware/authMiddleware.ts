import { Response, Request, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface DecodedToken {
    id: string;
    role: string;
    iat: number;
    exp: number;
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
    try{
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(400).json({ messsage: "Not authorized, no token"});
        }

        const token = authHeader.split(" ")[1];
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("JWT_SECRET is not defined in .env");
        }

        const decoded = jwt.verify(token, secret) as DecodedToken;
        req.userId = decoded.id;
        req.userRole = decoded.role;

        next();
    } catch (error) {
        return res.status(401).json({ message: "Not authoried, invalid token" });
    }
};