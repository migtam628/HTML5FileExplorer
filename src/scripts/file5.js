'use strict';
/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

class HTML5FileExplorer {

  /**
   * Create the HTML5FileExplorer app.
   */
  constructor(handle) {
    this._cwd = null;
    this._pathBack = [];
    this._pathForward = [];

    this._footer = document.getElementById('footer');
    this._headerText = document.querySelector('header h1');
    this._container = document.querySelector('.file-container-inner');
    this._previewContainer = document.getElementById('preview-container');
    this._previewTitle = document.querySelector('#dialogPreview .dialog-title');

    this._showDialog('dialogStart', false);
    this._navOpen(handle);

    this._backButton = document.getElementById('butBack');
    this._backButton.addEventListener('click', () => {
      this._navBack();
    });

    this._forwardButton = document.getElementById('butForward');
    this._forwardButton.addEventListener('click', () => {
      this._navForward();
    });
    this._initDialogs();
  }

  _navBack() {
    if (this._pathBack.length > 0) {
      this._pathForward.push(this._cwd);
      this._cwd = this._pathBack.pop();
      this._showDirectory();
      this._footer.removeChild(this._footer.lastChild);
    }
  }

  _navForward() {
    if (this._pathForward.length > 0) {
      this._pathBack.push(this._cwd);
      this._cwd = this._pathForward.pop();
      this._showDirectory();
      this._updateFooter(this._cwd.name);
    }
  }

  _navOpen(handle) {
    if (this._cwd) {
      this._pathBack.push(this._cwd);
    }
    this._cwd = handle;
    this._pathForward = [];
    this._showDirectory();
    this._updateFooter(this._cwd.name);
  }

  _showDialog(id, visible) {
    const container = document.getElementById('dialogContainer');
    const dialog = document.getElementById(id);
    container.classList.toggle('hidden', !visible);
    dialog.classList.toggle('hidden', !visible);
  }

  _initDialogs() {
    const about = document.getElementById('dialogAbout');
    about.querySelector('.close').addEventListener('click', () => {
      this._showDialog('dialogAbout', false);
    });
    const preview = document.getElementById('dialogPreview');
    preview.querySelector('.close').addEventListener('click', () => {
      this._showDialog('dialogPreview', false);
    });
  }

  _clearFolder() {
    const inner = document.createElement('div');
    inner.className = 'file-container-inner';
    this._container.replaceWith(inner);
    this._container = inner;
  }

  async _showDirectory() {
    this._clearFolder();

    const cwd = this._cwd;
    this._headerText.textContent = cwd.name;
    const entries = await cwd.getEntries();
    for await (const entry of entries) {
      this._addEntry(entry);
    }
    this._updateBackForward();
  }

  _addEntry(entry) {
    const entryContainer = document.createElement('div');
    entryContainer.className = 'entry';
    entryContainer.draggable = true;
    entryContainer.entry = entry;
    const img = document.createElement('img');
    if (entry.isDirectory) {
      img.src = '/images/ic_folder_black_48dp.svg';
    } else {
      img.src = '/images/ic_insert_drive_file_black_48dp.svg';
    }
    entryContainer.appendChild(img);
    const filename = document.createElement('span');
    filename.textContent = entry.name;
    entryContainer.appendChild(filename);
    entryContainer.addEventListener('dblclick', () => {
      if (entry.isDirectory) {
        return this._navOpen(entry);
      }
      return this._previewFile(entry);
    });
    this._container.appendChild(entryContainer);
  }

  _updateFooter(directoryName) {
    const elem = document.createElement('span');
    elem.textContent = `/${directoryName}`;
    this._footer.appendChild(elem);
  }

  async _previewFile(handle) {
    try {
      const file = await handle.getFile();
      console.log('h', handle);
      console.log('f', file);
      const filename = file.name;
      const extStart = filename.lastIndexOf('.');
      let extension = '';
      if (extStart > 0) {
        extension = filename.substr(extStart + 1);
      }
      let canPreview = false;
      if (extension === 'json' || extension === 'txt') {
        canPreview = await this._previewText(file);
      } else if (extension === 'png') {
        canPreview = await this._previewImage(file);
      }
      if (canPreview) {
        this._previewTitle.textContent = handle.name;
        this._showDialog('dialogPreview', true);
      } else {
        console.log('nope');
      }
    } catch (ex) {
      console.error('err', ex);
    }
  }

  async _previewImage(file) {
    const bitmap = await createImageBitmap(file);
    const elem = document.createElement('canvas');
    const ctx = elem.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bitmap);
    this._previewContainer.replaceWith(elem);
    this._previewContainer = elem;
    return true;
  }

  async _previewText(file) {
    const contents = await file.text();
    const elem = document.createElement('pre');
    elem.textContent = contents;
    this._previewContainer.replaceWith(elem);
    this._previewContainer = elem;
    return true;
  }

  _updateBackForward() {
    if (this._pathBack.length > 0) {
      this._backButton.removeAttribute('disabled');
    } else {
      this._backButton.setAttribute('disabled', true);
    }
    if (this._pathForward.length > 0) {
      this._forwardButton.removeAttribute('disabled');
    } else {
      this._forwardButton.setAttribute('disabled', true);
    }
  }

  // const pete = document.getElementById('pete');
  // pete.addEventListener('keydown', (e) => {
  //   console.log(e.keyCode);
  //   if (e.keyCode === 13) {
  //     e.preventDefault();
  //     document.body.focus();
  //     console.log(pete.textContent);
  //     pete.removeAttribute('contenteditable');
  //   }
  // });
}
