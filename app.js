// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2023 Chris Dragan

"use strict";

// Padding between cells in the editor
const pad_size = 2;

var img_width  = 24;
var img_height = 24;
var editor     = null;
var preview    = null;

function OnPageLoad()
{
    editor  = new Editor("image");
    preview = new Preview("preview");

    window.addEventListener("resize", OnResize);
    OnResize();
}

function OnResize()
{
    editor.Update();
    preview.Draw();
}

function OnMouseMove(e)
{
    editor.OnMouseMove(e.clientX, e.clientY);
}

function Elem(id)
{
    this.elem = (typeof id === "string") ? document.getElementById(id) : id;
}

Elem.prototype.setContents = function(contents)
{
    this.elem.innerHTML = contents;
    return this;
};

Elem.prototype.setAttr = function(name, value)
{
    const attr = document.createAttribute(name);
    attr.value = value;
    this.elem.setAttributeNode(attr);
    return this;
};

function E(id)
{
    return (id instanceof Elem) ? id : new Elem(id);
}

function DrawSvg(id)
{
    this.elem = E(id);
    this.contents = "";
}

DrawSvg.prototype.Commit = function()
{
    this.elem.setContents(this.contents);
    this.contents = "";
};

function SvgColor(color)
{
    return (color[0] === "#") ? ('style="fill: ' + color + '"') : ('class="' + color + '"');
}

DrawSvg.prototype.Rect = function(id, color, x, y, width, height)
{
    this.contents += '<rect id="' + id + '" ' +
                           SvgColor(color) + " " +
                           'x="' + x + '" ' +
                           'y="' + y + '" ' +
                           'width="' + width + '" ' +
                           'height="' + height + '" ' +
                           '/>';
    return this;
};

function Editor(id)
{
    this.elem = E(id);
}

Editor.prototype.Update = function()
{
    // Set height of image-container and image to match the width
    const elem = E("image-container");
    const width  = Math.floor(elem.elem.offsetWidth);
    const height = Math.floor(width * img_height / img_width);
    elem.elem.style.height = height + "px";
    this.elem.setAttr("width", width);
    this.elem.setAttr("height", height);

    this.Draw();
};

Editor.prototype.Draw = function()
{
    const rect        = this.elem.elem.getBoundingClientRect();
    const phys_width  = rect.right - rect.left;
    const phys_height = rect.bottom - rect.top;
    const cell_width  = Math.floor((phys_width - pad_size) / img_width);
    const cell_height = Math.floor((phys_height - pad_size) / img_height);

    const viewbox_width  = (cell_width * img_width) + pad_size;
    const viewbox_height = (cell_height * img_height) + pad_size;
    this.elem.setAttr("viewbox", "0 0 " + phys_width + " " + phys_height);

    const svg = new DrawSvg(this.elem);

    for (let x = 0; x <= img_width; x++) {
        svg.Rect("", "grid", x * cell_width, 0, pad_size, img_height * cell_height + pad_size);
    }
    for (let y = 0; y <= img_height; y++) {
        svg.Rect("", "grid", 0, y * cell_height, img_width * cell_width, pad_size);
    }

    svg.Rect("sel-bg", "sel-bg", 0, 0, cell_width + pad_size, cell_height + pad_size);

    for (let y = 0; y < img_height; y++) {
        for (let x = 0; x < img_width; x++) {
            svg.Rect("ed_" + x + "_" + y,
                     "#00000000",
                     x * cell_width + pad_size,
                     y * cell_height + pad_size,
                     cell_width - pad_size,
                     cell_height - pad_size);
        }
    }

    svg.Commit();

    E("sel-bg").setAttr("visibility", "hidden");
    E("sel-bg").setAttr("class", "sel-bg");

    this.cell_width  = cell_width;
    this.cell_height = cell_height;
};

Editor.prototype.OnMouseMove = function(client_x, client_y)
{
    const rect = this.elem.elem.getBoundingClientRect();
    const x    = Math.floor((client_x - rect.x) / this.cell_width);
    const y    = Math.floor((client_y - rect.y) / this.cell_height);

    const sel_bg = E("sel-bg");

    if (x < 0 || y < 0 || x >= img_width || y >= img_height) {
        sel_bg.setAttr("visibility", "hidden");
        return;
    }

    sel_bg.setAttr("visibility", "visible");
    sel_bg.setAttr("transform", "translate(" + (x * this.cell_width) + "," + (y * this.cell_height) + ")");
};

function Preview(id)
{
    this.elem = E(id);
}

Preview.prototype.Draw = function()
{
    const canvas = document.createElement("canvas");
    canvas.width  = img_width;
    canvas.height = img_height;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "blue";
    ctx.fillRect(0, 0, img_width, img_height);

    this.elem.elem.src = canvas.toDataURL();
};
