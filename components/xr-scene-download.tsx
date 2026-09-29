"use client";
import { useEffect, useState } from "react";
import { reviewExport, type XRScene, type Decision } from "@/lib/xr-scene";

export function XRSceneDownload({ scene, decisions }: { scene: XRScene; decisions: Record<string, Decision> }) {
  const [file, setFile] = useState<{ url: string; text: string; name: string }>();
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);
  function prepare() {
    const text = JSON.stringify({ ...reviewExport(scene, decisions), activated: false }, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const name = `${scene.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "storywalker"}-scene.json`;
    setFile({ url, text, name });
    // Standard attachment response works in browsers that block Blob downloads.
    const form = document.createElement("form");
    form.method = "POST"; form.action = "/api/xr/download"; form.target = "_blank";
    const field = document.createElement("input"); field.type = "hidden"; field.name = "scene"; field.value = text;
    form.appendChild(field); document.body.appendChild(form); form.submit(); form.remove();
  }
  return <div>
    <button type="button" onClick={prepare}>Download current scene</button>
    {file && <div role="status"><p>Prepared {file.name} with your current positions, treatments and all review decisions. Reopening keeps activation off.</p><a href={file.url} download={file.name}>Save prepared scene file</a><details><summary>If the browser blocks downloads</summary><p>Copy this JSON into a local .json file, then use Load selected scene. It includes private selected evidence.</p><textarea aria-label="Prepared scene JSON" readOnly value={file.text} rows={8} style={{ width: "100%" }} onFocus={event => event.currentTarget.select()} /></details></div>}
  </div>;
}
