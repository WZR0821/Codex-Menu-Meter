# 图标来源

由内置 imagegen 工具生成并修整，具体图像模型版本未披露。来源参考为用户提供的 Codex 与 Claude 桌面图标截图。

母版：`assets/icon-source.png`。`npm run build:icons` 生成 macOS ICNS、各尺寸 PNG 与不透明白底手机图标。母版保留透明边缘；手机端使用白底避免 iOS 主屏出现黑角。

生成提示词：

> Use case: logo-brand. Create one finished macOS application icon for Codex Menu Meter, a joint Codex and Claude usage meter. Reference is the user-provided image: Codex is a softly sculpted blue violet lobed cloud bearing a white terminal >_ mark; Claude is an orange tile with a white irregular radial starburst. Fuse these into ONE coherent sculptural emblem, not two side-by-side tiles: a compact blue-violet cloud in the center-left seamlessly joined to a warm coral-orange radial sunburst on the right, with an unmistakable crisp white >_ terminal glyph integrated across the center. White pearl rounded-square macOS tile, subtle dimensional bevel, refined soft studio lighting, calm clean Apple desktop visual quality. Emblem large and legible at 32 px, simple silhouette, minimal soft shading, no tiny details, no words, no numbers, no watermark, no mockup desktop or surrounding UI. Square 1024x1024 composition. Tile occupies about 88% of canvas, centered with equal padding. True transparent exterior outside tile; retain the white tile itself.

修整提示词：

> Edit this icon. Preserve the exact beautiful central blue violet cloud merging into orange Claude starburst, white >_ terminal glyph, pearl white rounded tile, proportions and lighting. Change ONLY the alpha silhouette: eliminate every stray white pixel, ragged outline, fleck and texture outside the tile. Make the rounded-square exterior perfectly smooth and crisp, with clean antialiasing and no debris. Exterior fully transparent. Keep equal generous transparent padding around all four sides; tile fits entirely inside the square image. This is a production macOS icon, not a mockup.
