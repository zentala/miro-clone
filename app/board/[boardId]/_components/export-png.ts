import { toPng } from "html-to-image";

/**
 * Downloads the authored layers as PNG. The view box is the layers' bounds in world
 * coordinates and the clone drops the camera transform, so pan and zoom never change
 * the image; the grid, selection and other `data-editor-overlay` elements are removed.
 */
export async function exportBoardPng(svg: SVGSVGElement, fileName: string) {
    const layers = svg.querySelector<SVGGElement>("[data-board-layers]");
    if (!layers) return;
    const bbox = layers.getBBox();
    const width = Math.max(1, bbox.width);
    const height = Math.max(1, bbox.height);
    const clone = svg.cloneNode(true) as SVGSVGElement;

    clone.setAttribute("width", width.toString());
    clone.setAttribute("height", height.toString());
    clone.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${width} ${height}`);
    clone.querySelector("[data-board-camera]")?.removeAttribute("transform");
    clone.querySelectorAll("[data-editor-overlay]").forEach(node => node.remove());
    document.body.appendChild(clone);

    try {
        const dataUrl = await toPng(clone as unknown as HTMLElement);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Error exporting SVG to PNG", error);
    } finally {
        document.body.removeChild(clone);
    }
}
