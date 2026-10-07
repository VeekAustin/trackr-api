import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-for-integration-tests';
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});