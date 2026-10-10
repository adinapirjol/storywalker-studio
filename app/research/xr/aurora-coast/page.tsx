import { XRLab } from "@/components/xr-lab";
import { AuroraIntegrationRehearsal } from "@/components/aurora-integration-rehearsal";
import { auroraCoastXR } from "@/lib/aurora-xr";

export const metadata = { title: "Aurora Coast · fictional Spatial Rehearsal" };
export default function AuroraCoastPage() {
  const fixture = auroraCoastXR();
  return <XRLab initialScene={fixture.scene} initialDecisions={fixture.decisions} fictionalPreview fictionalBody={<AuroraIntegrationRehearsal />} />;
}
