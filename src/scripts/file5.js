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
    this._cwd = handle;
    this._history = {
      back: [],
      forward: [],
    };
    this._path = `/${handle.name}`;
    this._depth = 0;

    history.replaceState({depth: this._depth}, null, `#!/${handle.name}`);

    this._footer = document.getElementById('footer');
    this._headerText = document.querySelector('header h1');
    this._container = document.querySelector('.file-container-inner');
    this._previewContainer = document.getElementById('preview-container');
    this._previewTitle = document.querySelector('#dialogPreview .dialog-title');

    this._showDialog('dialogStart', false);
    this._renderDirectory();

    this._butRefresh = document.getElementById('butRefresh');
    this._butRefresh.addEventListener('click', () => {
      this._renderDirectory();
    });

    this._backButton = document.getElementById('butBack');
    this._backButton.addEventListener('click', () => {
      window.history.back();
    });

    this._forwardButton = document.getElementById('butForward');
    this._forwardButton.addEventListener('click', () => {
      window.history.forward();
    });

    document.addEventListener('keydown', (e) => {
      this._handleKeystroke(e);
    });

    document.addEventListener('click', (e) => {
      this._clearSelected();
    });

    window.addEventListener('popstate', (e) => {
      const curDepth = this._depth;
      const newDepth = e.state.depth;
      if (newDepth < curDepth) {
        this._navBack();
      } else if (newDepth > curDepth) {
        this._navForward();
      }
    });

    this._initDialogs();
  }

  _handleKeystroke(e) {
    const key = e.key;
    const keyCode = e.keyCode;

    // TODO: Handle CTRL-N: Create new directory

    // Rename entry if only 1 is selected
    if (key === 'Enter') {
      e.preventDefault();
      const selectedElems = this._getSelectedItems();
      if (selectedElems.length === 1) {
        this._makeFilenameEditable(selectedElems[0]);
      }
      return;
    }

    // Arrow keys
    if (keyCode >= 37 && keyCode <= 40) {
      e.preventDefault();
      const selectedElems = this._getSelectedItems();
      if (selectedElems.length === 1) {
        let newElem = null;
        if (key === 'ArrowRight') {
          newElem = selectedElems[0].nextSibling;
        } else if (key === 'ArrowLeft') {
          newElem = selectedElems[0].previousSibling;
        } else if (key === 'ArrowDown') {
          window.alert('TODO: ArrowDown');
        } else {
          window.alert('TODO: ArrowUp');
        }
        if (newElem) {
          this._selectItem(newElem);
        }
      }
      return;
    }

    // Delete file
    if (key === 'Delete') {
      e.preventDefault();
      this._executeDelete();
      return;
    }

    // Refresh directory (WIN/APPLE+r)
    if (e.metaKey && key === 'r') {
      e.preventDefault();
      this._renderDirectory();
      return;
    }

    console.log('_handleKeystroke', key, keyCode, e);
  }

  _handleKeystrokeElement(e) {
    const key = e.key;
    const keyCode = e.keyCode;
    console.log('_handleKeystrokeElement', e, key, keyCode);
  }

  _navBack() {
    if (this._history.back.length === 0) {
      return;
    }
    this._history.forward.push(this._cwd);
    this._cwd = this._history.back.pop();
    this._depth--;
    this._path = this._path.substr(0, this._path.lastIndexOf('/'));
    this._renderDirectory();
  }

  _navForward() {
    if (this._history.forward.length === 0) {
      return;
    }
    this._history.back.push(this._cwd);
    this._cwd = this._history.forward.pop();
    this._depth++;
    this._path += `/${this._cwd.name}`;
    this._renderDirectory();
  }

  _navOpen(newDir) {
    this._history.back.push(this._cwd);
    this._history.forward = [];
    this._cwd = newDir;
    this._depth++;
    this._path += `/${newDir.name}`;
    this._renderDirectory();
    history.pushState({depth: this._depth}, null, `#!${this._path}`);
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

  async _renderDirectory() {
    this._clearFolder();
    const cwd = this._cwd;
    this._headerText.textContent = cwd.name;
    const entries = await cwd.getEntries();
    for await (const entry of entries) {
      this._addEntry(entry);
    }
    this._footer.textContent = this._path;
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
    // TODO: Is this a hack?
    filename.addEventListener('click', () => {
      if (entryContainer.classList.contains('selected')) {
        this._makeFilenameEditable(entryContainer);
      }
    });
    filename.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const keyCode = e.keyCode;
      if (keyCode === 13 || keyCode === 27) {
        e.preventDefault();
        filename.removeAttribute('contenteditable');
        if (keyCode === 27) {
          filename.textContent = entry.name;
          return;
        }
        if (entry.name === filename.textContent) {
          return;
        }
        this._executeRename(entry, filename.textContent);
      }
    });
    entryContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      this._selectItem(entryContainer);
    });
    entryContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (entry.isDirectory) {
        return this._navOpen(entry);
      }
      return this._previewFile(entry);
    });
    this._container.appendChild(entryContainer);
  }

  _getSelectedItems() {
    return document.querySelectorAll('.entry.selected');
  }

  _clearSelected() {
    this._getSelectedItems().forEach((e) => {
      e.classList.remove('selected');
    });
  }

  _selectItem(elem) {
    this._clearSelected();
    if (elem) {
      elem.classList.add('selected');
    }
  }

  _makeFilenameEditable(elem) {
    const filenameElem = elem.querySelector('span');
    filenameElem.setAttribute('contenteditable', true);
    filenameElem.setAttribute('spellcheck', false);
    filenameElem.focus();
  }

  _executeRename(handle, newFilename) {
    window.alert(`TODO: Rename '${handle.name}' to '${newFilename}'`)
  }

  _executeDelete() {
    const elems = this._getSelectedItems();
    if (elems.length === 0) {
      return;
    }
    const files = [];
    elems.forEach((elem) => {
      files.push(elem.entry.name);
    });
    window.alert(`TODO: Delete files [${files.toString()}]`);
    this._clearSelected();
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
    if (this._history.back.length > 0) {
      this._backButton.removeAttribute('disabled');
    } else {
      this._backButton.setAttribute('disabled', true);
    }
    if (this._history.forward.length > 0) {
      this._forwardButton.removeAttribute('disabled');
    } else {
      this._forwardButton.setAttribute('disabled', true);
    }
  }
}
