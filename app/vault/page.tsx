import { PrivateVault } from "@/components/private-vault";

export const dynamic = "force-dynamic";

export default async function VaultPage({searchParams}:{searchParams:Promise<{returnTo?:string}>}) { const {returnTo}=await searchParams;return <PrivateVault returnTo={returnTo} />; }
