import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
    // Read the MedicalTests.json file from the project root
    const jsonPath = path.resolve(__dirname, "../../MedicalTests.json");
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const tests: { TestID: string; TestName: string }[] = JSON.parse(rawData);

    console.log(`Found ${tests.length} medical tests to seed...`);

    let created = 0;
    let skipped = 0;

    for (const test of tests) {
        try {
            await prisma.medicalTests.upsert({
                where: { TestID: test.TestID },
                update: { TestName: test.TestName },
                create: {
                    TestID: test.TestID,
                    TestName: test.TestName,
                },
            });
            created++;
        } catch (error) {
            console.error(`Failed to upsert test "${test.TestName}":`, error);
            skipped++;
        }
    }

    console.log(`Seeding complete: ${created} tests upserted, ${skipped} skipped.`);
}

main()
    .catch((e) => {
        console.error("Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
