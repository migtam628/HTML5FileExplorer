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
  constructor(directoryHandle) {
    this._directoryHistory = [];
    this._directoryPosition = 0;
    this._container = document.querySelector('.file-container-inner');
    this._previewContainer = document.getElementById('preview-container');
    this._previewTitle = document.querySelector('#dialogPreview .dialog-title');
    this._backButton = document.getElementById('butBack');
    this._forwardButton = document.getElementById('butForward');
    this._headerText = document.querySelector('header h1');
    this._directoryHistory.push(directoryHandle);
    this._showDialog('dialogStart', false);
    this._showDirectory();
    this._backButton.addEventListener('click', () => {
      if (this._directoryPosition > 0) {
        this._directoryPosition--;
        this._showDirectory(this._directoryPosition);
      }
    });
    this._forwardButton.addEventListener('click', () => {
      if (this._directoryPosition <= this._directoryHistory.length) {
        this._directoryPosition++;
        this._showDirectory(this._directoryPosition);
      }
    });
    this._initDialogs();
  }

  _getCWD() {
    return this._directoryHistory[this._directoryPosition];
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

  _addEntry(entry) {
    const entryContainer = document.createElement('div');
    entryContainer.className = 'entry';
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
    // console.log('ff', entry);
    entryContainer.addEventListener('dblclick', () => {
      if (entry.isDirectory) {
        this._openDirectory(entry);
        // this._directoryHistory.push(entry);
        // this._directoryPosition = this._directoryHistory.length - 1;
        // console.log('l', this._directoryHistory.length, 'i', this._directoryPosition)

        this._showDirectory();
        return;
      }
      return this._previewFile(entry);
    });
    this._container.appendChild(entryContainer);
  }

  _openDirectory(entry) {
    const index = this._directoryPosition;
    const numEntries = this._directoryHistory.length;
    console.log('l', numEntries, 'i', index)
    if (numEntries === index + 1) {
      this._directoryHistory.push(entry);
      this._directoryPosition = this._directoryHistory.length - 1;
    } else {
      console.log('here', 'l', numEntries, 'i', index);
    }
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

  async _showDirectory() {
    this._clearFolder();
    const index = this._directoryPosition;
    const handle = this._directoryHistory[index];
    this._headerText.textContent = handle.name;
    const entries = await handle.getEntries();
    for await (const entry of entries) {
      this._addEntry(entry);
    }
    this._updateBackForward();
    this._updatePath();
  }

  _updatePath() {
    const footer = document.getElementById('footer');
    const index = this._directoryPosition;
    if (index === this._directoryHistory.length - 1) {
      console.log('append', this._getCWD().name);
      const elem = document.createElement('span');
      elem.textContent = `/${this._getCWD().name}`;
      footer.appendChild(elem);
    } else {
      const elem = footer.lastChild;
      footer.removeChild(elem);
      // console.log('remove');
    }
  }

  _updateBackForward() {
    const index = this._directoryPosition;
    if (index === 0) {
      this._backButton.setAttribute('disabled', true);
    } else {
      this._backButton.removeAttribute('disabled');
    }
    if (index < this._directoryHistory.length - 1) {
      this._forwardButton.removeAttribute('disabled');
    } else {
      this._forwardButton.setAttribute('disabled', true);
    }
  }
}
