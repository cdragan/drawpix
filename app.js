// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2023 Chris Dragan

"use strict";

// Padding in pixels between cells in the editor
const pad_size = 2;

// Maximum dimensions in pixels (both width or height) of the edited image
const max_dim = 256;

// Initial color, black, completely transparent, format: RRGGBBAA
const init_color = "00000000";

// Editor modes
const Mode = {
    set_color: 1
};

var editor = null;

function OnPageLoad()
{
    editor = new Editor("image", "preview", "all");
    editor.RebuildPalette(true);
    editor.UpdateDimensions();

    window.addEventListener("resize", function() { editor.UpdateWindowSize(); });
}

function Elem(id)
{
    this.elem = (typeof id === "string") ? document.getElementById(id) : id;
}

Elem.prototype = {

    setContents: function(contents)
    {
        this.elem.innerHTML = contents;
        return this;
    },

    setAttr: function(name, value)
    {
        const attr = document.createAttribute(name);
        attr.value = value;
        this.elem.setAttributeNode(attr);
        return this;
    }
};

function E(id)
{
    return (id instanceof Elem) ? id : new Elem(id);
}

function SvgColor(color)
{
    return (color[0] === "#") ? ('style="fill: ' + color + '"') : ('class="' + color + '"');
}

function DrawSvg(id)
{
    this.elem = E(id);
    this.contents = "";
}

DrawSvg.prototype = {

    Commit: function()
    {
        this.elem.setContents(this.contents);
        this.contents = "";
    },

    Rect: function(id, color, x, y, width, height)
    {
        id = id ? ('id="' + id + '"') : "";
        this.contents += '<rect ' + id + ' ' +
                               SvgColor(color) + " " +
                               'x="' + x + '" ' +
                               'y="' + y + '" ' +
                               'width="' + width + '" ' +
                               'height="' + height + '" ' +
                               '/>';
        return this;
    },

    BeginGroup: function(id)
    {
        this.contents += '<g id="' + id + '">';
    },

    EndGroup: function()
    {
        this.contents += "</g>";
    }
};

function GetDimension(id)
{
    const value = parseInt(E(id).elem.value, 10);
    return (isNaN(value) || (value < 1) || (value > max_dim)) ? null : value;
}

function GetComponentValue(v)
{
    const text = v.toString(16);
    if (v < 16)
        return "0" + text;
    return text;
}

function Editor(editor_id, preview_id, all_id)
{
    this.elem           = E(editor_id);
    this.preview        = E(preview_id);
    this.all_img        = E(all_id);
    this.img_width      = 0;
    this.img_height     = 0;
    this.img_count      = 0;
    this.mode           = Mode.set_color;
    // Multiple selectors for symmetric drawing
    this.sel_bg         = [null, null, null, null];
    this.sel_fg         = [null, null, null, null];
    this.undo           = [];
    this.redo           = [];
    this.palette        = [];
    this.cur_color      = 0;
    this.images         = [];
    this.cur_image      = 0;
    this.preview_canvas = document.createElement("canvas");
    this.all_img_canvas = document.createElement("canvas");
    this.mouse_down     = false;
}

Editor.prototype = {

    ResizeImages: function(new_width, new_height, new_count)
    {
        // Remove images at the end, if reducing their number
        if (new_count < this.images.length) {
            this.images.length = new_count;
        }

        // Resize all images
        if ((new_width != this.img_width) || (new_height != this.img_height)) {
            const old_row_size = Math.min(this.img_width,  new_width);
            const old_height   = Math.min(this.img_height, new_height);
            const new_row_tail = (new_width > this.img_width)
                ? (new Array(new_width - this.img_width)).fill(init_color) : [];
            const new_tail     = (new_height > this.img_height)
                ? (new Array(new_width * (new_height - this.img_height))).fill(init_color) : null;

            for (let i = 0; i < this.images.length; i++) {
                let old_img = this.images[i];
                let new_img = [];

                // Copy existing rows, append new/clear tail (if wider)
                for (let y = 0; y < old_height; y++) {
                    let old_row_pos = y * this.img_width;
                    let old_row = old_img.slice(old_row_pos, old_row_pos + old_row_size);
                    new_img = new_img.concat(old_row, new_row_tail);
                }

                // Append new rows (if taller)
                for (let y = old_height; y < new_height; y++) {
                    new_img = new_img.concat(new_tail);
                }

                this.images[i] = new_img;
            }
        }

        // Add new images
        for (let i = this.images.length; i < new_count; i++) {
            this.images[i] = (new Array(new_width * new_height)).fill(init_color);
        }

        this.img_width  = new_width;
        this.img_height = new_height;
        this.img_count  = new_count;
    },

    UpdateDimensions: function()
    {
        const new_width  = GetDimension("img_width")  || this.img_width;
        const new_height = GetDimension("img_height") || this.img_height;
        const new_count  = GetDimension("img_count")  || this.img_count;

        if (new_width  == this.img_width  &&
            new_height == this.img_height &&
            new_count  == this.img_count) {
            return;
        }

        if (this.img_width) {
            // TODO update undo stack
        }

        const preview_cont_width = new_width + 10;
        E("preview-container").setAttr("style", "width: " + preview_cont_width + "px");
        E("image-container").elem.style.marginRight = preview_cont_width + "px";

        this.ResizeImages(new_width, new_height, new_count);

        this.DrawPalette();

        this.UpdateWindowSize();
    },

    UpdateWindowSize: function()
    {
        // Set height of image-container and image to match the width
        const elem = E("image-container");
        const width  = Math.floor(elem.elem.offsetWidth);
        const height = Math.floor(width * this.img_height / this.img_width);
        elem.elem.style.height = height + "px";

        this.elem.setAttr("width", width);
        this.elem.setAttr("height", height);
        this.elem.setAttr("viewbox", "0 0 " + width + " " + height);

        this.DrawEditor();

        this.DrawPreview();

        this.DrawAllImg();
    },

    RebuildPalette: function(clear)
    {
        const img_width  = this.img_width;
        const img_height = this.img_height;

        const old_color = this.palette.length ? this.palette[this.cur_color] : "FFFFFFFF";

        if ( ! this.palette.length || clear) {
            this.palette = ["00000000"];
        }

        const img = this.images[this.cur_image];
        for (let y = 0; y < img_height; y++) {
            for (let x = 0; x < img_width; x++) {
                let color = img[y * img_width + x];
                if (color.length === 6) {
                    color += "FF";
                }

                if (this.palette.indexOf(color) === -1) {
                    this.palette.push(color);
                }
            }
        }

        if (this.palette.length == 1) {
            this.palette.push("FFFFFFFF");
        }

        let i;
        for (i = 0; i < this.palette.length; i++) {
            if (this.palette[i] === old_color) {
                break;
            }
        }
        this.cur_color = (i < this.palette.length) ? i : 1;
    },

    DrawPalette: function()
    {
        let contents = "";

        for (let i = 0; i < this.palette.length; i++) {
            let color = this.palette[i];
            let rgb   = color.slice(0, 6);
            let alpha = color.slice(6);

            contents += '<div><label class="palette-color" id="palette-label-' + i + '" ' +
                        'onclick="editor.SelectColor(' + i + ')" ' +
                        'style="background-color: #' + color + '">' +
                        '<input type="color" id="palette-rgb-' + i + '" value="#' + rgb + '" ' +
                        'oninput="editor.ChangePalette(' + i + ')" ' +
                        'onchange="editor.ChangePalette(' + i + ')">' +
                        '<input type="text" id="palette-alpha-' + i + '" size="3" maxLength="2" value="' + alpha + '" ' +
                        'onkeyup="editor.ChangePalette(' + i + ')">' +
                        '</label></div>';
        }

        contents += '<div style="margin-bottom: 0"><button onclick="editor.AddColorToPalette()">Add Color</button></div>';
        contents += '<div><button onclick="editor.OptimizePalette()">Optimize</button></div>';

        E("palette").setContents(contents);

        if (this.cur_color >= this.palette.length) {
            this.cur_color = this.palette.length - 1;
        }
        E("palette-label-" + this.cur_color).setAttr("class", "palette-selected-color");
    },

    DrawEditor: function()
    {
        const img_width   = this.img_width;
        const img_height  = this.img_height;
        const rect        = this.elem.elem.getBoundingClientRect();
        const phys_width  = rect.right - rect.left;
        const phys_height = rect.bottom - rect.top;
        const cell_width  = Math.floor((phys_width - pad_size) / img_width);
        const cell_height = Math.floor((phys_height - pad_size) / img_height);

        const svg = new DrawSvg(this.elem);

        for (let x = 0; x <= img_width; x++) {
            svg.Rect("", "grid", x * cell_width, 0, pad_size, img_height * cell_height + pad_size);
        }
        for (let y = 0; y <= img_height; y++) {
            svg.Rect("", "grid", 0, y * cell_height, img_width * cell_width, pad_size);
        }

        const img = this.images[this.cur_image];
        for (let y = 0; y < img_height; y++) {
            for (let x = 0; x < img_width; x++) {
                svg.Rect("ed-" + x + "-" + y,
                         "#" + img[y * img_width + x],
                         x * cell_width + pad_size,
                         y * cell_height + pad_size,
                         cell_width - pad_size,
                         cell_height - pad_size);
            }
        }

        const color = this.palette[this.cur_color];

        for (let i = 0; i < this.sel_bg.length; i++) {
            svg.BeginGroup("sel-bg-" + i);
            svg.Rect("", "sel-bg", 0, 0, cell_width + pad_size, pad_size);
            svg.Rect("", "sel-bg", 0, cell_height, cell_width + pad_size, pad_size);
            svg.Rect("", "sel-bg", 0, pad_size, pad_size, cell_height - pad_size);
            svg.Rect("", "sel-bg", cell_width, pad_size, pad_size, cell_height - pad_size);
            svg.Rect("sel-fg-" + i, "#" + color, pad_size, pad_size, cell_width - pad_size, cell_height - pad_size);
            svg.EndGroup();
        }

        svg.Commit();

        for (let i = 0; i < this.sel_bg.length; i++) {
            this.sel_bg[i] = E("sel-bg-" + i);
            this.sel_fg[i] = E("sel-fg-" + i);
            this.sel_bg[i].setAttr("visibility", "hidden");
            this.sel_fg[i].setAttr("visibility", "hidden");
        }

        this.cell_width  = cell_width;
        this.cell_height = cell_height;
    },

    DrawPreview: function()
    {
        const img_width  = this.img_width;
        const img_height = this.img_height;

        this.preview_canvas.width  = img_width;
        this.preview_canvas.height = img_height;

        const ctx = this.preview_canvas.getContext("2d");

        const img = this.images[this.cur_image];
        for (let y = 0; y < img_height; y++) {
            for (let x = 0; x < img_width; x++) {
                ctx.fillStyle = "#" + img[y * img_width + x];
                ctx.fillRect(x, y, 1, 1);
            }
        }

        this.UpdatePreviewImage();
    },

    UpdatePreviewImage: function()
    {
        this.preview.elem.src = this.preview_canvas.toDataURL();
    },

    DrawAllImg: function()
    {
        const img_width  = this.img_width;
        const img_height = this.img_height;
        const img_count  = this.img_count;

        this.all_img_canvas.width  = img_width * img_count;
        this.all_img_canvas.height = img_height;

        const ctx = this.all_img_canvas.getContext("2d");

        for (let i = 0; i < img_count; i++) {
            let img = this.images[i];
            for (let y = 0; y < img_height; y++) {
                for (let x = 0; x < img_width; x++) {
                    ctx.fillStyle = "#" + img[y * img_width + x];
                    ctx.fillRect(x + img_width * i, y, 1, 1);
                }
            }
        }

        this.UpdateAllImages();
    },

    UpdateAllImages: function()
    {
        this.all_img.elem.src = this.all_img_canvas.toDataURL();
    },

    UpdateMode: function()
    {
        this.mirror_x = E("mirror_x").elem.checked;
        this.mirror_y = E("mirror_y").elem.checked;
    },

    SetColor: function(x, y, color)
    {
        let img = this.images[this.cur_image];
        const img_offs = y * this.img_width + x;
        const old_color = img[img_offs];
        if (old_color === color) {
            return old_color;
        }

        img[img_offs] = color;

        let ed_elem = E("ed-" + x + "-" + y);
        ed_elem.setAttr("style", "fill: #" + color);

        let ctx = this.preview_canvas.getContext("2d");
        if (color.slice(6) !== "FF") {
            ctx.clearRect(x, y, 1, 1);
        }
        if (color !== "00000000") {
            ctx.fillStyle = "#" + color;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx = this.all_img_canvas.getContext("2d");
        const all_x = x + this.cur_image * this.img_width;
        if (color.slice(6) !== "FF") {
            ctx.clearRect(all_x, y, 1, 1);
        }
        if (color !== "00000000") {
            ctx.fillStyle = "#" + color;
            ctx.fillRect(all_x, y, 1, 1);
        }

        return old_color;
    },

    GetSelectedCell: function(client_x, client_y)
    {
        const rect = this.elem.elem.getBoundingClientRect();
        const x    = Math.floor((client_x - rect.x) / this.cell_width);
        const y    = Math.floor((client_y - rect.y) / this.cell_height);
        return { x: x, y: y };
    },

    GetCellIndex: function(i, x, y)
    {
        if (x < 0 || y < 0 || x >= this.img_width || y >= this.img_height) {
            return null;
        }

        let visible = true;

        switch (i) {
            case 1:
            case 3:
                if ( ! this.mirror_x) {
                    visible = false;
                }
                if ((this.img_width & 1) && (x === this.img_width - 1 - x)) {
                    return null;
                }
                x = this.img_width - 1 - x;
                if (i === 1) {
                    break;
                }
            case 2:
                if ( ! this.mirror_y) {
                    visible = false;
                }
                if ((this.img_height & 1) && (y === this.img_height - 1 - y)) {
                    return null;
                }
                y = this.img_height - 1 - y;
        }

        return { x: x, y: y, visible: visible };
    },

    OnMouseMove: function(e)
    {
        const client_x = e.clientX;
        const client_y = e.clientY;

        this.UpdateMode();

        const sel = this.GetSelectedCell(client_x, client_y);

        for (let i = 0; i < this.sel_bg.length; i++) {
            let cell = this.GetCellIndex(i, sel.x, sel.y);

            if (cell) {
                cell.x *= this.cell_width;
                cell.y *= this.cell_height;
                this.sel_bg[i].setAttr("visibility", "visible");
                this.sel_bg[i].setAttr("transform", "translate(" + cell.x + "," + cell.y + ")");
                this.sel_fg[i].setAttr("visibility", cell.visible ? "visible" : "hidden");
            }
            else {
                this.sel_bg[i].setAttr("visibility", "hidden");
                this.sel_fg[i].setAttr("visibility", "hidden");
            }
        }

        if (this.mouse_down) {
            this.OnMouseClick(e);
        }
    },

    OnMouseLeave: function()
    {
        this.mouse_down = false;

        for (let i = 0; i < this.sel_bg.length; i++) {
            this.sel_bg[i].setAttr("visibility", "hidden");
            this.sel_fg[i].setAttr("visibility", "hidden");
        }
    },

    OnMouseDown: function(e)
    {
        this.mouse_down = true;
        this.OnMouseClick(e);
    },

    OnMouseUp: function(e)
    {
        this.mouse_down = false;
    },

    OnMouseClick: function(e)
    {
        const client_x = e.clientX;
        const client_y = e.clientY;

        this.UpdateMode();

        const sel = this.GetSelectedCell(client_x, client_y);

        const color = this.palette[this.cur_color];

        const undo_action = {
            name:      "Set Pixel",
            image:     this.cur_image,
            new_color: color,
            palette:   false,
            pixels:    []
        };

        let num_changed = 0;

        for (let i = 0; i < this.sel_bg.length; i++) {
            let cell = this.GetCellIndex(i, sel.x, sel.y);

            if ( ! cell || ! cell.visible) {
                continue;
            }

            let old_color = this.SetColor(cell.x, cell.y, color);

            if (old_color !== color) {
                ++num_changed;

                undo_action.pixels.push({
                    x:         cell.x,
                    y:         cell.y,
                    old_color: old_color
                });
            }
        }

        if ( ! num_changed) {
            return;
        }

        this.undo.push(undo_action);
        this.redo = [];

        this.UpdatePreviewImage();
        this.UpdateAllImages();
    },

    OnImageSelect: function(e)
    {
        const client_x = e.clientX;
        const client_y = e.clientY;

        const rect = this.all_img.elem.getBoundingClientRect();
        const img  = Math.floor((client_x - rect.x) / this.img_width);

        if (img < 0 || img >= this.img_count) {
            return;
        }

        this.SelectImage(img);
    },

    SelectImage: function(img)
    {
        this.cur_image = img;

        this.DrawEditor();

        this.DrawPreview();

        this.OptimizePalette();
    },

    UpdateSelCursor: function()
    {
        const color = this.palette[this.cur_color];
        for (let i = 0; i < this.sel_fg.length; i++) {
            this.sel_fg[i].setAttr("style", "fill: #" + color);
        }
    },

    SelectColor: function(i)
    {
        if (i !== this.cur_color) {
            E("palette-label-" + this.cur_color).setAttr("class", "palette-color");
            E("palette-label-" + i).setAttr("class", "palette-selected-color");
            this.cur_color = i;
            this.UpdateSelCursor();
        }
    },

    ChangePalette: function(pal_idx)
    {
        let new_rgb = E("palette-rgb-" + pal_idx).elem.value;

        let new_alpha = E("palette-alpha-" + pal_idx).elem.value;
        if ( ! /^[A-Fa-f0-9]*$/.test(new_alpha)) {
            return;
        }

        let new_color = new_rgb.slice(1) + new_alpha;

        while (new_color.length < 8) {
            new_color += (new_color.length < 6) ? "0" : "F";
        }

        new_color = new_color.toUpperCase();

        const old_color = this.palette[pal_idx];
        if (old_color === new_color) {
            return;
        }
        this.palette[pal_idx] = new_color;

        E("palette-label-" + pal_idx).elem.style = "background-color: #" + new_color;

        this.UpdateSelCursor();

        // If another color in the palette was the same, don't modify the image
        for (let i = 0; i < this.palette.length; i++) {
            if (i !== pal_idx && this.palette[i] === old_color) {
                return;
            }
        }

        const img_width  = this.img_width;
        const img_height = this.img_height;
        let   changed    = false;

        const undo_action = {
            name:      "Change Color",
            image:     this.cur_image,
            new_color: new_color,
            palette:   true,
            pixels:    []
        };

        const img = this.images[this.cur_image];
        for (let y = 0; y < img_height; y++) {
            for (let x = 0; x < img_width; x++) {
                let img_offs = y * img_width + x;

                let cur_color = img[img_offs];
                if (cur_color.length === 6) {
                    cur_color += "FF";
                }

                if (old_color === cur_color) {
                    undo_action.pixels.push({
                        x:         x,
                        y:         y,
                        old_color: old_color
                    });

                    img[img_offs] = new_color;
                    changed = true;
                }
            }
        }

        if (changed) {
            this.undo.push(undo_action);
            this.DrawEditor();
            this.DrawPreview();
            this.DrawAllImg();
        }
    },

    AddColorToPalette: function()
    {
        this.palette.push("FFFFFFFF");
        this.cur_color = this.palette.length - 1;
        this.UpdateSelCursor();
        this.DrawPalette();
    },

    OptimizePalette: function()
    {
        this.RebuildPalette(true);
        this.UpdateSelCursor();
        this.DrawPalette();
    },

    Undo: function()
    {
        if (this.undo.length === 0) {
            return;
        }

        const action = this.undo.pop();
        this.redo.push(action);

        if (action.image !== this.cur_image) {
            this.SelectImage(action.image);
        }

        if ("pixels" in action) {
            const pixels = action.pixels;
            for (let i = 0; i < pixels.length; i++) {
                let pixel = pixels[i];
                this.SetColor(pixel.x, pixel.y, pixel.old_color);
            }

            this.UpdatePreviewImage();
            this.UpdateAllImages();

            if (action.palette) {
                this.OptimizePalette();
            }
        }
    },

    LoadFile: function()
    {
        const file_input = E("file-input").elem;

        if ( ! file_input.files || ! file_input.files[0]) {
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            const load_img = new Image();

            load_img.onload = function() {
                editor.LoadImage(load_img);
            };

            load_img.src = e.target.result;
        };

        reader.readAsDataURL(file_input.files[0]);
    },

    LoadImage: function(img)
    {
        const orig_width = img.naturalWidth;
        const new_height = img.naturalHeight;

        let new_width = new_height;
        let new_count = Math.floor(orig_width / new_width);

        if (new_count * new_width !== orig_width) {
            // TODO
        }

        E("img_width").elem.value  = new_width;
        E("img_height").elem.value = new_height;
        E("img_count").elem.value  = new_count;

        this.cur_image = 0;

        this.ResizeImages(new_width, new_height, new_count);

        this.GetImageData(img);

        this.undo = [];
        this.redo = [];

        this.DrawEditor();
        this.DrawPreview();
        this.DrawAllImg();
        this.OptimizePalette();
    },

    GetImageData: function(img)
    {
        const img_width  = this.img_width;
        const img_height = this.img_height;
        const img_count  = this.img_count;

        const tmpCanvas  = document.createElement("canvas");
        tmpCanvas.width  = img_width * img_count;
        tmpCanvas.height = img_height;

        const ctx = tmpCanvas.getContext("2d", { willReadFrequently: true });

        ctx.drawImage(img, 0, 0, img_width * img_count, img_height);

        for (let y = 0; y < img_height; y++) {
            let line_offs = y * img_width;
            for (let i = 0; i < img_count; i++) {
                for (let x = 0; x < img_width; x++) {
                    let value = ctx.getImageData(i * img_width + x, y, 1, 1).data;
                    let color = "";
                    for (let c = 0; c < 4; c++) {
                        color += GetComponentValue(value[c]);
                    }
                    this.images[i][line_offs + x] = color.toUpperCase();
                }
            }
        }
    },

    SaveFile: function()
    {
        const link = document.createElement("a");
        link.href = this.all_img_canvas.toDataURL("image/png");
        link.download = "image.png";
        link.click();
    }
};
