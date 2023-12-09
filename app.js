// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: Copyright (c) 2023 Chris Dragan

"use strict";

// Padding between cells in the editor
const pad_size = 2;

// Maximum dimension (width or height) of the edited image
const max_dim = 256;

var editor = null;

function OnPageLoad()
{
    editor = new Editor("image", "preview");

    window.addEventListener("resize", OnResize);
    OnResize();
}

function OnResize()
{
    editor.Update();
}

function OnMouseMove(e)
{
    editor.OnMouseMove(e.clientX, e.clientY);
}

function OnMouseClick(e)
{
    editor.OnMouseClick(e.clientX, e.clientY);
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
    }
};

function GetDimension(id)
{
    const value = parseInt(E(id).elem.value, 10);
    if (isNaN(value) || (value < 1) || (value > max_dim))
        return null;
    return value;
}

function Editor(id, preview_id)
{
    this.elem       = E(id);
    this.preview    = E(preview_id);
    this.img_width  = 0;
    this.img_height = 0;
}

Editor.prototype = {

    Update: function()
    {
        this.img_width  = GetDimension("img_width")  || this.img_width;
        this.img_height = GetDimension("img_height") || this.img_height;

        // Set height of image-container and image to match the width
        const elem = E("image-container");
        const width  = Math.floor(elem.elem.offsetWidth);
        const height = Math.floor(width * this.img_height / this.img_width);
        elem.elem.style.height = height + "px";
        this.elem.setAttr("width", width);
        this.elem.setAttr("height", height);
        this.elem.setAttr("viewbox", "0 0 " + width + " " + height);

        this.Draw();
        this.DrawPreview();
    },

    Draw: function()
    {
        const rect        = this.elem.elem.getBoundingClientRect();
        const phys_width  = rect.right - rect.left;
        const phys_height = rect.bottom - rect.top;
        const cell_width  = Math.floor((phys_width - pad_size) / this.img_width);
        const cell_height = Math.floor((phys_height - pad_size) / this.img_height);

        const svg = new DrawSvg(this.elem);

        for (let x = 0; x <= this.img_width; x++) {
            svg.Rect("", "grid", x * cell_width, 0, pad_size, this.img_height * cell_height + pad_size);
        }
        for (let y = 0; y <= this.img_height; y++) {
            svg.Rect("", "grid", 0, y * cell_height, this.img_width * cell_width, pad_size);
        }

        svg.Rect("sel-bg", "sel-bg", 0, 0, cell_width + pad_size, cell_height + pad_size);

        for (let y = 0; y < this.img_height; y++) {
            for (let x = 0; x < this.img_width; x++) {
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
    },

    DrawPreview: function()
    {
        const img_width  = this.img_width;
        const img_height = this.img_height;

        const canvas = document.createElement("canvas");
        canvas.width  = img_width;
        canvas.height = img_height;

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "blue";
        ctx.fillRect(0, 0, img_width, img_height);

        this.preview.elem.src = canvas.toDataURL();
    },

    OnMouseMove: function(client_x, client_y)
    {
        const rect = this.elem.elem.getBoundingClientRect();
        const x    = Math.floor((client_x - rect.x) / this.cell_width);
        const y    = Math.floor((client_y - rect.y) / this.cell_height);

        const sel_bg = E("sel-bg");

        if (x < 0 || y < 0 || x >= this.img_width || y >= this.img_height) {
            sel_bg.setAttr("visibility", "hidden");
            return;
        }

        sel_bg.setAttr("visibility", "visible");
        sel_bg.setAttr("transform", "translate(" + (x * this.cell_width) + "," + (y * this.cell_height) + ")");
    },

    OnMouseClick: function(client_x, client_y)
    {
        const rect = this.elem.elem.getBoundingClientRect();
        const x    = Math.floor((client_x - rect.x) / this.cell_width);
        const y    = Math.floor((client_y - rect.y) / this.cell_height);
    }
};
