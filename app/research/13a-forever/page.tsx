import { ArenaReader } from "@/components/arena-reader";
import { readArenaSnapshot } from "@/lib/arena-snapshot";

export const dynamic = "force-static";
export const metadata = { title: "13A Forever · Reader", description: "An ordered walk through two Are.na research channels." };

export default async function ForeverReaderPage() { return <ArenaReader snapshot={await readArenaSnapshot()} />; }
