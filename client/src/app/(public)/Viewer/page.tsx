// app/CameraViewer/page.jsx   (server component)
import CameraViewer from "@/components/(Viewer)/Viewer";

export default function Page() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Camera Viewer</h1>
      <CameraViewer />
    </main>
  );
}
