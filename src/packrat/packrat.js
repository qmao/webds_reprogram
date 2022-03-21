
export class BlobFile {
	constructor(filename, blobContent)
	{
		this.name = filename;
		this.content = blobContent;
	}
};

export default function DownloadBlob(packrat_id, extension)
{
	let packratSession = new PackratSession({
		serverUrl: " http://packrat.synaptics.com:8090/service"
	});

	console.log(packratSession);

	try {
		packratSession.connect();
		var pingResult = packratSession.ping();
		console.log("pingResult = " + pingResult);
	}
	catch (e) {
		console.log(e);
		throw "Cannot connect to Packrat server";
	}

	//still need to pass an empty auth token
	packratSession.login("", "");
	console.log("authToken = " + packratSession.authToken);

	console.log(packrat_id);

	var exists = packratSession.exists(packrat_id);
	console.log(exists);
	if (!exists) {
		throw "Packrat not exists";
	}

	let fileList = packratSession.listFiles(packrat_id);

	console.log(fileList);

	var fileToDownload = fileList[0];
	console.log(fileToDownload);

	for (let i = 0; i < fileList.length; i++) {
		console.log(i);
		console.log(fileList[i].filename);
		if (fileList[i].filename.endsWith(extension)) {
			fileToDownload = fileList[i];
			console.log(fileToDownload);
		}
	}

	let fileBlob = packratSession.downloadFileAsBlob(packrat_id, fileToDownload.filename);
	console.log("fileBlob.name = " + fileBlob.name);
	console.log("fileBlob.content = " + fileBlob.content.size);
	
	return fileBlob;
}




////http://sjc1uvt-packrat01.synaptics.com:8088/Packrat_Client.js

var PackratSession = function(args) {
  this.thriftClient = null;
  this.thriftTransport = null;
  this.thriftProtocol = null;
  this.serverUrl = null;
  this.debugMode = null;
  if (args) {
    if (args.serverUrl !== undefined && args.serverUrl !== null) {
      this.serverUrl = args.serverUrl;
    }
  }
};


PackratSession.prototype = {

    authToken: null,
    thriftClient: null,
    thriftTransport: null,
    thriftProtocol: null,

    connect: function () {
        this.thriftTransport = new Thrift.Transport(this.serverUrl, {useCORS: true});
        this.thriftProtocol = new Thrift.TJSONProtocol(this.thriftTransport);
        this.thriftClient = new PackratClient(this.thriftProtocol);
    },

    close: function () {
        this.thriftClient = null;
        this.thriftProtocol = null;
        this.thriftTransport = null;
    },

    login: function(username, password) {
        if (this.thriftClient) {
            this.authToken = this.thriftClient.login(username, password);
        } else {
            throw "Client not set";
        }
    },

    convertStringToUtf8ByteArray: function (str) {
        let binaryArray = new Uint8Array(str.length);
        Array.prototype.forEach.call(binaryArray, function (el, idx, arr) {
            arr[idx] = str.charCodeAt(idx)
        });
        return binaryArray;
    },

    saveFile: function (filename, fileDataBlob) {
        // var fileDataBin = this.convertStringToUtf8ByteArray(fileDataStr);
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        // var fileBlob = new Blob([fileDataBin], {type: "application/octet-stream"}),
        let url = URL.createObjectURL(fileDataBlob);
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    },

    sha512Digest: function (data) {
        return crypto.subtle.digest("SHA-512", data).then(buf => {
            return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
        });
    },

    downloadFileListAsBlob: function (packratId, fileList) {
        if (fileList && fileList.constructor && fileList.constructor.toString().indexOf("Array") > -1) {
            let returnList = new Array();
            for (let i = 0; i < fileList.length; i++) {
                let fileBlob = this.downloadFileAsBlob(packratId, fileList[i]);
                returnList.push(fileBlob);
            }
            return returnList;
        }
        return new Array();
    },

    downloadFileAsBlob: function(packratId, filename) {
        //eval("debugger;");
        if (this.authToken && this.thriftClient) {
            console.log("Requesting download...");
            let downloadRequest = this.thriftClient.request_download(packratId, filename, this.authToken, DEFAULT_BLOCKSIZE);
            if (downloadRequest) {
                console.log("Starting download for packratId: " + packratId + ": " + filename + "");
                var fileBlock = this.thriftClient.next_file_block(downloadRequest.requestId);
                var completeFile = fileBlock;
                while (null !== fileBlock && fileBlock.length > 0) {
                    fileBlock = this.thriftClient.next_file_block(downloadRequest.requestId);
                    completeFile += fileBlock;
                }
                console.log(completeFile);
                if (null !== completeFile) {
                    console.log("file_hash = " + downloadRequest.file_hash);
                    console.log(completeFile.length);
                    // let checksumPromise = this.sha512Digest(this.convertStringToUtf8ByteArray(completeFile));
                    // let checksum = "";
                    // checksumPromise.then(x => {
                    //     checksum += x;
                    //     console.log(x);
                    //     return x;
                    // });
                    console.log("Download of file " + filename + " complete. Saving file...");
                    // this.saveFile(filename, completeFile);
                    // if (downloadRequest.file_hash === checksum) {
                    //     this.saveFile(filename, completeFile);
                    // }
                }
                this.endDownload(downloadRequest.requestId);
                let fileBlob = new Blob([this.convertStringToUtf8ByteArray(completeFile)], {type: "application/octet-stream"});
                return new BlobFile(filename, fileBlob);
            }
        } else {
            throw "Client or AuthToken not set";
        }
    },

    validateAndSaveFile: function () {

    },
    
    endDownload: function (requestId) {
        if (this.thriftClient) {
            this.thriftClient.end_download(requestId);
        }
    },

    listFiles: function (packratId) {
        if (this.thriftClient) {
            return this.thriftClient.list_files(packratId);
        } else {
            throw "Client instance not set";
        }
    },

    exists: function(packratId) {
        if (this.thriftClient) {
            return this.thriftClient.exists(packratId);
        } else {
            throw "Client or AuthToken not set";
        }
    },

    ping: function () {
        return this.thriftClient.ping();
    }

};



////http://sjc1uvt-packrat01.synaptics.com:8088/Packrat.js
//
// Autogenerated by Thrift Compiler (0.15.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//
if (typeof Int64 === 'undefined' && typeof require === 'function') {
  var Int64 = require('node-int64');
}


//HELPER FUNCTIONS AND STRUCTURES

var Packrat_ping_args = function(args) {
};
Packrat_ping_args.prototype = {};
Packrat_ping_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    input.skip(ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_ping_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_ping_args');
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_ping_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
  }
};
Packrat_ping_result.prototype = {};
Packrat_ping_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRING) {
        this.success = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_ping_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_ping_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRING, 0);
    output.writeString(this.success);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_latest_args = function(args) {
};
Packrat_get_latest_args.prototype = {};
Packrat_get_latest_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    input.skip(ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_latest_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_latest_args');
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_latest_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
  }
};
Packrat_get_latest_result.prototype = {};
Packrat_get_latest_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.I32) {
        this.success = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_latest_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_latest_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.I32, 0);
    output.writeI32(this.success);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_allocate_args = function(args) {
};
Packrat_allocate_args.prototype = {};
Packrat_allocate_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    input.skip(ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_allocate_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_allocate_args');
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_allocate_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
  }
};
Packrat_allocate_result.prototype = {};
Packrat_allocate_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.I32) {
        this.success = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_allocate_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_allocate_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.I32, 0);
    output.writeI32(this.success);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_exists_args = function(args) {
  this.packrat_id = null;
  if (args) {
    if (args.packrat_id !== undefined && args.packrat_id !== null) {
      this.packrat_id = args.packrat_id;
    }
  }
};
Packrat_exists_args.prototype = {};
Packrat_exists_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packrat_id = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_exists_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_exists_args');
  if (this.packrat_id !== null && this.packrat_id !== undefined) {
    output.writeFieldBegin('packrat_id', Thrift.Type.I32, 1);
    output.writeI32(this.packrat_id);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_exists_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
  }
};
Packrat_exists_result.prototype = {};
Packrat_exists_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.BOOL) {
        this.success = input.readBool().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_exists_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_exists_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.BOOL, 0);
    output.writeBool(this.success);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_keywords_args = function(args) {
  this.packrat_id = null;
  if (args) {
    if (args.packrat_id !== undefined && args.packrat_id !== null) {
      this.packrat_id = args.packrat_id;
    }
  }
};
Packrat_get_keywords_args.prototype = {};
Packrat_get_keywords_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packrat_id = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_keywords_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_keywords_args');
  if (this.packrat_id !== null && this.packrat_id !== undefined) {
    output.writeFieldBegin('packrat_id', Thrift.Type.I32, 1);
    output.writeI32(this.packrat_id);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_keywords_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = Thrift.copyList(args.success, [null]);
    }
  }
};
Packrat_get_keywords_result.prototype = {};
Packrat_get_keywords_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.LIST) {
        this.success = [];
        var _rtmp31 = input.readListBegin();
        var _size0 = _rtmp31.size || 0;
        for (var _i2 = 0; _i2 < _size0; ++_i2) {
          var elem3 = null;
          elem3 = input.readString().value;
          this.success.push(elem3);
        }
        input.readListEnd();
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_keywords_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_keywords_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.LIST, 0);
    output.writeListBegin(Thrift.Type.STRING, this.success.length);
    for (var iter4 in this.success) {
      if (this.success.hasOwnProperty(iter4)) {
        iter4 = this.success[iter4];
        output.writeString(iter4);
      }
    }
    output.writeListEnd();
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_login_args = function(args) {
  this.username = null;
  this.password = null;
  if (args) {
    if (args.username !== undefined && args.username !== null) {
      this.username = args.username;
    }
    if (args.password !== undefined && args.password !== null) {
      this.password = args.password;
    }
  }
};
Packrat_login_args.prototype = {};
Packrat_login_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.username = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.password = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_login_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_login_args');
  if (this.username !== null && this.username !== undefined) {
    output.writeFieldBegin('username', Thrift.Type.STRING, 1);
    output.writeString(this.username);
    output.writeFieldEnd();
  }
  if (this.password !== null && this.password !== undefined) {
    output.writeFieldBegin('password', Thrift.Type.STRING, 2);
    output.writeString(this.password);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_login_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = new AuthToken(args.success);
    }
  }
};
Packrat_login_result.prototype = {};
Packrat_login_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRUCT) {
        this.success = new AuthToken();
        this.success.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_login_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_login_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
    this.success.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_validate_token_args = function(args) {
  this.auth_token = null;
  if (args) {
    if (args.auth_token !== undefined && args.auth_token !== null) {
      this.auth_token = new AuthToken(args.auth_token);
    }
  }
};
Packrat_validate_token_args.prototype = {};
Packrat_validate_token_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth_token = new AuthToken();
        this.auth_token.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_validate_token_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_validate_token_args');
  if (this.auth_token !== null && this.auth_token !== undefined) {
    output.writeFieldBegin('auth_token', Thrift.Type.STRUCT, 1);
    this.auth_token.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_validate_token_result = function(args) {
  this.success = null;
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
  }
};
Packrat_validate_token_result.prototype = {};
Packrat_validate_token_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.BOOL) {
        this.success = input.readBool().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_validate_token_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_validate_token_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.BOOL, 0);
    output.writeBool(this.success);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_logout_args = function(args) {
  this.auth_token = null;
  if (args) {
    if (args.auth_token !== undefined && args.auth_token !== null) {
      this.auth_token = new AuthToken(args.auth_token);
    }
  }
};
Packrat_logout_args.prototype = {};
Packrat_logout_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth_token = new AuthToken();
        this.auth_token.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_logout_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_logout_args');
  if (this.auth_token !== null && this.auth_token !== undefined) {
    output.writeFieldBegin('auth_token', Thrift.Type.STRUCT, 1);
    this.auth_token.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_logout_result = function(args) {
};
Packrat_logout_result.prototype = {};
Packrat_logout_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    input.skip(ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_logout_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_logout_result');
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_request_download_args = function(args) {
  this.packratId = null;
  this.filename = null;
  this.auth_token = null;
  this.blockSize = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.filename !== undefined && args.filename !== null) {
      this.filename = args.filename;
    }
    if (args.auth_token !== undefined && args.auth_token !== null) {
      this.auth_token = new AuthToken(args.auth_token);
    }
    if (args.blockSize !== undefined && args.blockSize !== null) {
      this.blockSize = args.blockSize;
    }
  }
};
Packrat_request_download_args.prototype = {};
Packrat_request_download_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.filename = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth_token = new AuthToken();
        this.auth_token.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.I32) {
        this.blockSize = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;      
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_request_download_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_request_download_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.filename !== null && this.filename !== undefined) {
    output.writeFieldBegin('filename', Thrift.Type.STRING, 2);
    output.writeString(this.filename);
    output.writeFieldEnd();
  }
  if (this.auth_token !== null && this.auth_token !== undefined) {
    output.writeFieldBegin('auth_token', Thrift.Type.STRUCT, 3);
    this.auth_token.write(output);
    output.writeFieldEnd();
  }
  if (this.blockSize !== null && this.blockSize !== undefined) {
    output.writeFieldBegin('blockSize', Thrift.Type.I32, 5);
    output.writeI32(this.blockSize);
    output.writeFieldEnd();
  }  
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_request_download_result = function(args) {
  this.success = null;
  this.nsf = null;
  this.np = null;
  this.le = null;
  this.nsp = null;
  this.ie = null;
  this.it = null;
  if (args instanceof NoSuchFile) {
    this.nsf = args;
    return;
  }
  if (args instanceof NotPermitted) {
    this.np = args;
    return;
  }
  if (args instanceof LoginException) {
    this.le = args;
    return;
  }
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = new DownloadRequest(args.success);
    }
    if (args.nsf !== undefined && args.nsf !== null) {
      this.nsf = args.nsf;
    }
    if (args.np !== undefined && args.np !== null) {
      this.np = args.np;
    }
    if (args.le !== undefined && args.le !== null) {
      this.le = args.le;
    }
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
  }
};
Packrat_request_download_result.prototype = {};
Packrat_request_download_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRUCT) {
        this.success = new DownloadRequest();
        this.success.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsf = new NoSuchFile();
        this.nsf.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.np = new NotPermitted();
        this.np.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.le = new LoginException();
        this.le.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 6:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_request_download_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_request_download_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
    this.success.write(output);
    output.writeFieldEnd();
  }
  if (this.nsf !== null && this.nsf !== undefined) {
    output.writeFieldBegin('nsf', Thrift.Type.STRUCT, 1);
    this.nsf.write(output);
    output.writeFieldEnd();
  }
  if (this.np !== null && this.np !== undefined) {
    output.writeFieldBegin('np', Thrift.Type.STRUCT, 2);
    this.np.write(output);
    output.writeFieldEnd();
  }
  if (this.le !== null && this.le !== undefined) {
    output.writeFieldBegin('le', Thrift.Type.STRUCT, 3);
    this.le.write(output);
    output.writeFieldEnd();
  }
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 4);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 5);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 6);
    this.it.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_download_file_block_args = function(args) {
  this.requestId = null;
  this.blockNumber = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
    if (args.blockNumber !== undefined && args.blockNumber !== null) {
      this.blockNumber = args.blockNumber;
    }
  }
};
Packrat_download_file_block_args.prototype = {};
Packrat_download_file_block_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.I32) {
        this.blockNumber = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_download_file_block_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_download_file_block_args');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  if (this.blockNumber !== null && this.blockNumber !== undefined) {
    output.writeFieldBegin('blockNumber', Thrift.Type.I32, 2);
    output.writeI32(this.blockNumber);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_download_file_block_result = function(args) {
  this.success = null;
  this.it = null;
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
  }
};
Packrat_download_file_block_result.prototype = {};
Packrat_download_file_block_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRING) {
        this.success = input.readBinary().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_download_file_block_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_download_file_block_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRING, 0);
    output.writeBinary(this.success);
    output.writeFieldEnd();
  }
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 1);
    this.it.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_next_file_block_args = function(args) {
  this.requestId = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
  }
};
Packrat_next_file_block_args.prototype = {};
Packrat_next_file_block_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_next_file_block_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_next_file_block_args');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_next_file_block_result = function(args) {
  this.success = null;
  this.it = null;
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = args.success;
    }
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
  }
};
Packrat_next_file_block_result.prototype = {};
Packrat_next_file_block_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRING) {
        this.success = input.readBinary().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_next_file_block_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_next_file_block_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRING, 0);
    output.writeBinary(this.success);
    output.writeFieldEnd();
  }
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 1);
    this.it.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_end_download_args = function(args) {
  this.requestId = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
  }
};
Packrat_end_download_args.prototype = {};
Packrat_end_download_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_end_download_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_end_download_args');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_end_download_result = function(args) {
};
Packrat_end_download_result.prototype = {};
Packrat_end_download_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    input.skip(ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_end_download_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_end_download_result');
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_request_upload_args = function(args) {
  this.info = null;
  this.auth_token = null;
  if (args) {
    if (args.info !== undefined && args.info !== null) {
      this.info = new UploadInfo(args.info);
    }
    if (args.auth_token !== undefined && args.auth_token !== null) {
      this.auth_token = new AuthToken(args.auth_token);
    }
  }
};
Packrat_request_upload_args.prototype = {};
Packrat_request_upload_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.info = new UploadInfo();
        this.info.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth_token = new AuthToken();
        this.auth_token.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_request_upload_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_request_upload_args');
  if (this.info !== null && this.info !== undefined) {
    output.writeFieldBegin('info', Thrift.Type.STRUCT, 1);
    this.info.write(output);
    output.writeFieldEnd();
  }
  if (this.auth_token !== null && this.auth_token !== undefined) {
    output.writeFieldBegin('auth_token', Thrift.Type.STRUCT, 2);
    this.auth_token.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_request_upload_result = function(args) {
  this.success = null;
  this.nsf = null;
  this.np = null;
  this.le = null;
  this.nsp = null;
  this.ie = null;
  this.it = null;
  if (args instanceof NoSuchFile) {
    this.nsf = args;
    return;
  }
  if (args instanceof NotPermitted) {
    this.np = args;
    return;
  }
  if (args instanceof LoginException) {
    this.le = args;
    return;
  }
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = new UploadRequest(args.success);
    }
    if (args.nsf !== undefined && args.nsf !== null) {
      this.nsf = args.nsf;
    }
    if (args.np !== undefined && args.np !== null) {
      this.np = args.np;
    }
    if (args.le !== undefined && args.le !== null) {
      this.le = args.le;
    }
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
  }
};
Packrat_request_upload_result.prototype = {};
Packrat_request_upload_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.STRUCT) {
        this.success = new UploadRequest();
        this.success.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsf = new NoSuchFile();
        this.nsf.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.np = new NotPermitted();
        this.np.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.le = new LoginException();
        this.le.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 6:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_request_upload_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_request_upload_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.STRUCT, 0);
    this.success.write(output);
    output.writeFieldEnd();
  }
  if (this.nsf !== null && this.nsf !== undefined) {
    output.writeFieldBegin('nsf', Thrift.Type.STRUCT, 1);
    this.nsf.write(output);
    output.writeFieldEnd();
  }
  if (this.np !== null && this.np !== undefined) {
    output.writeFieldBegin('np', Thrift.Type.STRUCT, 2);
    this.np.write(output);
    output.writeFieldEnd();
  }
  if (this.le !== null && this.le !== undefined) {
    output.writeFieldBegin('le', Thrift.Type.STRUCT, 3);
    this.le.write(output);
    output.writeFieldEnd();
  }
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 4);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 5);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 6);
    this.it.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_send_file_block_args = function(args) {
  this.requestId = null;
  this.data = null;
  this.block_number = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
    if (args.data !== undefined && args.data !== null) {
      this.data = args.data;
    }
    if (args.block_number !== undefined && args.block_number !== null) {
      this.block_number = args.block_number;
    }
  }
};
Packrat_send_file_block_args.prototype = {};
Packrat_send_file_block_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.data = input.readBinary().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.I32) {
        this.block_number = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_send_file_block_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_send_file_block_args');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  if (this.data !== null && this.data !== undefined) {
    output.writeFieldBegin('data', Thrift.Type.STRING, 2);
    output.writeBinary(this.data);
    output.writeFieldEnd();
  }
  if (this.block_number !== null && this.block_number !== undefined) {
    output.writeFieldBegin('block_number', Thrift.Type.I32, 3);
    output.writeI32(this.block_number);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_send_file_block_result = function(args) {
  this.it = null;
  this.ie = null;
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_send_file_block_result.prototype = {};
Packrat_send_file_block_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_send_file_block_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_send_file_block_result');
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 1);
    this.it.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 2);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_end_upload_args = function(args) {
  this.requestId = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
  }
};
Packrat_end_upload_args.prototype = {};
Packrat_end_upload_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_end_upload_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_end_upload_args');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_end_upload_result = function(args) {
  this.it = null;
  this.ie = null;
  if (args instanceof InvalidTransfer) {
    this.it = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.it !== undefined && args.it !== null) {
      this.it = args.it;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_end_upload_result.prototype = {};
Packrat_end_upload_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.it = new InvalidTransfer();
        this.it.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_end_upload_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_end_upload_result');
  if (this.it !== null && this.it !== undefined) {
    output.writeFieldBegin('it', Thrift.Type.STRUCT, 1);
    this.it.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 2);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_add_comment_args = function(args) {
  this.packratId = null;
  this.comment = null;
  this.username = null;
  this.auth_token = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.comment !== undefined && args.comment !== null) {
      this.comment = args.comment;
    }
    if (args.username !== undefined && args.username !== null) {
      this.username = args.username;
    }
    if (args.auth_token !== undefined && args.auth_token !== null) {
      this.auth_token = new AuthToken(args.auth_token);
    }
  }
};
Packrat_add_comment_args.prototype = {};
Packrat_add_comment_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.comment = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.username = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.auth_token = new AuthToken();
        this.auth_token.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_add_comment_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_add_comment_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.comment !== null && this.comment !== undefined) {
    output.writeFieldBegin('comment', Thrift.Type.STRING, 2);
    output.writeString(this.comment);
    output.writeFieldEnd();
  }
  if (this.username !== null && this.username !== undefined) {
    output.writeFieldBegin('username', Thrift.Type.STRING, 3);
    output.writeString(this.username);
    output.writeFieldEnd();
  }
  if (this.auth_token !== null && this.auth_token !== undefined) {
    output.writeFieldBegin('auth_token', Thrift.Type.STRUCT, 4);
    this.auth_token.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_add_comment_result = function(args) {
  this.nsp = null;
  this.le = null;
  this.ie = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof LoginException) {
    this.le = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.le !== undefined && args.le !== null) {
      this.le = args.le;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_add_comment_result.prototype = {};
Packrat_add_comment_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.le = new LoginException();
        this.le.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_add_comment_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_add_comment_result');
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.le !== null && this.le !== undefined) {
    output.writeFieldBegin('le', Thrift.Type.STRUCT, 2);
    this.le.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 3);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_qa_status_args = function(args) {
  this.packratId = null;
  this.qa_status = null;
  this.message = null;
  this.username = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.qa_status !== undefined && args.qa_status !== null) {
      this.qa_status = args.qa_status;
    }
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
    if (args.username !== undefined && args.username !== null) {
      this.username = args.username;
    }
  }
};
Packrat_set_qa_status_args.prototype = {};
Packrat_set_qa_status_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.qa_status = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRING) {
        this.username = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_qa_status_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_qa_status_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.qa_status !== null && this.qa_status !== undefined) {
    output.writeFieldBegin('qa_status', Thrift.Type.STRING, 2);
    output.writeString(this.qa_status);
    output.writeFieldEnd();
  }
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 3);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  if (this.username !== null && this.username !== undefined) {
    output.writeFieldBegin('username', Thrift.Type.STRING, 4);
    output.writeString(this.username);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_qa_status_result = function(args) {
  this.nsp = null;
  this.ia = null;
  this.io = null;
  this.ie = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InvalidArgument) {
    this.ia = args;
    return;
  }
  if (args instanceof IllegalOperation) {
    this.io = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ia !== undefined && args.ia !== null) {
      this.ia = args.ia;
    }
    if (args.io !== undefined && args.io !== null) {
      this.io = args.io;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_set_qa_status_result.prototype = {};
Packrat_set_qa_status_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ia = new InvalidArgument();
        this.ia.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.io = new IllegalOperation();
        this.io.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_qa_status_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_qa_status_result');
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ia !== null && this.ia !== undefined) {
    output.writeFieldBegin('ia', Thrift.Type.STRUCT, 2);
    this.ia.write(output);
    output.writeFieldEnd();
  }
  if (this.io !== null && this.io !== undefined) {
    output.writeFieldBegin('io', Thrift.Type.STRUCT, 3);
    this.io.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 4);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_uuid_args = function(args) {
  this.packratId = null;
  this.uuid = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.uuid !== undefined && args.uuid !== null) {
      this.uuid = args.uuid;
    }
  }
};
Packrat_set_uuid_args.prototype = {};
Packrat_set_uuid_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.uuid = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_uuid_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_uuid_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.uuid !== null && this.uuid !== undefined) {
    output.writeFieldBegin('uuid', Thrift.Type.STRING, 2);
    output.writeString(this.uuid);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_uuid_result = function(args) {
  this.nsp = null;
  this.already = null;
  this.ia = null;
  this.ie = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof AlreadySet) {
    this.already = args;
    return;
  }
  if (args instanceof InvalidArgument) {
    this.ia = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.already !== undefined && args.already !== null) {
      this.already = args.already;
    }
    if (args.ia !== undefined && args.ia !== null) {
      this.ia = args.ia;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_set_uuid_result.prototype = {};
Packrat_set_uuid_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.already = new AlreadySet();
        this.already.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.ia = new InvalidArgument();
        this.ia.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_uuid_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_uuid_result');
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.already !== null && this.already !== undefined) {
    output.writeFieldBegin('already', Thrift.Type.STRUCT, 2);
    this.already.write(output);
    output.writeFieldEnd();
  }
  if (this.ia !== null && this.ia !== undefined) {
    output.writeFieldBegin('ia', Thrift.Type.STRUCT, 3);
    this.ia.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 4);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_attrs_args = function(args) {
  this.packratId = null;
  this.attributes = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.attributes !== undefined && args.attributes !== null) {
      this.attributes = Thrift.copyList(args.attributes, [null]);
    }
  }
};
Packrat_get_attrs_args.prototype = {};
Packrat_get_attrs_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.LIST) {
        this.attributes = [];
        var _rtmp36 = input.readListBegin();
        var _size5 = _rtmp36.size || 0;
        for (var _i7 = 0; _i7 < _size5; ++_i7) {
          var elem8 = null;
          elem8 = input.readI32().value;
          this.attributes.push(elem8);
        }
        input.readListEnd();
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_attrs_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_attrs_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.attributes !== null && this.attributes !== undefined) {
    output.writeFieldBegin('attributes', Thrift.Type.LIST, 2);
    output.writeListBegin(Thrift.Type.I32, this.attributes.length);
    for (var iter9 in this.attributes) {
      if (this.attributes.hasOwnProperty(iter9)) {
        iter9 = this.attributes[iter9];
        output.writeI32(iter9);
      }
    }
    output.writeListEnd();
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_get_attrs_result = function(args) {
  this.success = null;
  this.nsp = null;
  this.ia = null;
  this.ie = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InvalidArgument) {
    this.ia = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = Thrift.copyMap(args.success, [null]);
    }
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ia !== undefined && args.ia !== null) {
      this.ia = args.ia;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_get_attrs_result.prototype = {};
Packrat_get_attrs_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.MAP) {
        this.success = {};
        var _rtmp311 = input.readMapBegin();
        var _size10 = _rtmp311.size || 0;
        for (var _i12 = 0; _i12 < _size10; ++_i12) {
          if (_i12 > 0 ) {
            if (input.rstack.length > input.rpos[input.rpos.length -1] + 1) {
              input.rstack.pop();
            }
          }
          var key13 = null;
          var val14 = null;
          key13 = input.readI32().value;
          val14 = input.readString().value;
          this.success[key13] = val14;
        }
        input.readMapEnd();
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ia = new InvalidArgument();
        this.ia.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_get_attrs_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_get_attrs_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.MAP, 0);
    output.writeMapBegin(Thrift.Type.I32, Thrift.Type.STRING, Thrift.objectLength(this.success));
    for (var kiter15 in this.success) {
      if (this.success.hasOwnProperty(kiter15)) {
        var viter16 = this.success[kiter15];
        output.writeI32(kiter15);
        output.writeString(viter16);
      }
    }
    output.writeMapEnd();
    output.writeFieldEnd();
  }
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ia !== null && this.ia !== undefined) {
    output.writeFieldBegin('ia', Thrift.Type.STRUCT, 2);
    this.ia.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 3);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_attrs_args = function(args) {
  this.packratId = null;
  this.new_values = null;
  this.username = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.new_values !== undefined && args.new_values !== null) {
      this.new_values = Thrift.copyMap(args.new_values, [null]);
    }
    if (args.username !== undefined && args.username !== null) {
      this.username = args.username;
    }
  }
};
Packrat_set_attrs_args.prototype = {};
Packrat_set_attrs_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.MAP) {
        this.new_values = {};
        var _rtmp318 = input.readMapBegin();
        var _size17 = _rtmp318.size || 0;
        for (var _i19 = 0; _i19 < _size17; ++_i19) {
          if (_i19 > 0 ) {
            if (input.rstack.length > input.rpos[input.rpos.length -1] + 1) {
              input.rstack.pop();
            }
          }
          var key20 = null;
          var val21 = null;
          key20 = input.readI32().value;
          val21 = input.readString().value;
          this.new_values[key20] = val21;
        }
        input.readMapEnd();
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.username = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_attrs_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_attrs_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.new_values !== null && this.new_values !== undefined) {
    output.writeFieldBegin('new_values', Thrift.Type.MAP, 2);
    output.writeMapBegin(Thrift.Type.I32, Thrift.Type.STRING, Thrift.objectLength(this.new_values));
    for (var kiter22 in this.new_values) {
      if (this.new_values.hasOwnProperty(kiter22)) {
        var viter23 = this.new_values[kiter22];
        output.writeI32(kiter22);
        output.writeString(viter23);
      }
    }
    output.writeMapEnd();
    output.writeFieldEnd();
  }
  if (this.username !== null && this.username !== undefined) {
    output.writeFieldBegin('username', Thrift.Type.STRING, 3);
    output.writeString(this.username);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_set_attrs_result = function(args) {
  this.nsp = null;
  this.ia = null;
  this.already = null;
  this.io = null;
  this.ie = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InvalidArgument) {
    this.ia = args;
    return;
  }
  if (args instanceof AlreadySet) {
    this.already = args;
    return;
  }
  if (args instanceof IllegalOperation) {
    this.io = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args) {
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ia !== undefined && args.ia !== null) {
      this.ia = args.ia;
    }
    if (args.already !== undefined && args.already !== null) {
      this.already = args.already;
    }
    if (args.io !== undefined && args.io !== null) {
      this.io = args.io;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
  }
};
Packrat_set_attrs_result.prototype = {};
Packrat_set_attrs_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ia = new InvalidArgument();
        this.ia.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.already = new AlreadySet();
        this.already.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.STRUCT) {
        this.io = new IllegalOperation();
        this.io.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_set_attrs_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_set_attrs_result');
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ia !== null && this.ia !== undefined) {
    output.writeFieldBegin('ia', Thrift.Type.STRUCT, 2);
    this.ia.write(output);
    output.writeFieldEnd();
  }
  if (this.already !== null && this.already !== undefined) {
    output.writeFieldBegin('already', Thrift.Type.STRUCT, 3);
    this.already.write(output);
    output.writeFieldEnd();
  }
  if (this.io !== null && this.io !== undefined) {
    output.writeFieldBegin('io', Thrift.Type.STRUCT, 4);
    this.io.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 5);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_list_files_args = function(args) {
  this.packratId = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
  }
};
Packrat_list_files_args.prototype = {};
Packrat_list_files_args.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_list_files_args.prototype.write = function(output) {
  output.writeStructBegin('Packrat_list_files_args');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var Packrat_list_files_result = function(args) {
  this.success = null;
  this.nsp = null;
  this.ie = null;
  this.nsf = null;
  if (args instanceof NoSuchPackrat) {
    this.nsp = args;
    return;
  }
  if (args instanceof InternalError) {
    this.ie = args;
    return;
  }
  if (args instanceof NoSuchFile) {
    this.nsf = args;
    return;
  }
  if (args) {
    if (args.success !== undefined && args.success !== null) {
      this.success = Thrift.copyList(args.success, [FileInfo]);
    }
    if (args.nsp !== undefined && args.nsp !== null) {
      this.nsp = args.nsp;
    }
    if (args.ie !== undefined && args.ie !== null) {
      this.ie = args.ie;
    }
    if (args.nsf !== undefined && args.nsf !== null) {
      this.nsf = args.nsf;
    }
  }
};
Packrat_list_files_result.prototype = {};
Packrat_list_files_result.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 0:
      if (ftype == Thrift.Type.LIST) {
        this.success = [];
        var _rtmp325 = input.readListBegin();
        var _size24 = _rtmp325.size || 0;
        for (var _i26 = 0; _i26 < _size24; ++_i26) {
          var elem27 = null;
          elem27 = new FileInfo();
          elem27.read(input);
          this.success.push(elem27);
        }
        input.readListEnd();
      } else {
        input.skip(ftype);
      }
      break;
      case 1:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsp = new NoSuchPackrat();
        this.nsp.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRUCT) {
        this.ie = new InternalError();
        this.ie.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRUCT) {
        this.nsf = new NoSuchFile();
        this.nsf.read(input);
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

Packrat_list_files_result.prototype.write = function(output) {
  output.writeStructBegin('Packrat_list_files_result');
  if (this.success !== null && this.success !== undefined) {
    output.writeFieldBegin('success', Thrift.Type.LIST, 0);
    output.writeListBegin(Thrift.Type.STRUCT, this.success.length);
    for (var iter28 in this.success) {
      if (this.success.hasOwnProperty(iter28)) {
        iter28 = this.success[iter28];
        iter28.write(output);
      }
    }
    output.writeListEnd();
    output.writeFieldEnd();
  }
  if (this.nsp !== null && this.nsp !== undefined) {
    output.writeFieldBegin('nsp', Thrift.Type.STRUCT, 1);
    this.nsp.write(output);
    output.writeFieldEnd();
  }
  if (this.ie !== null && this.ie !== undefined) {
    output.writeFieldBegin('ie', Thrift.Type.STRUCT, 2);
    this.ie.write(output);
    output.writeFieldEnd();
  }
  if (this.nsf !== null && this.nsf !== undefined) {
    output.writeFieldBegin('nsf', Thrift.Type.STRUCT, 3);
    this.nsf.write(output);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var PackratClient = function(input, output) {
  this.input = input;
  this.output = (!output) ? input : output;
  this.seqid = 0;
};
PackratClient.prototype = {};

PackratClient.prototype.ping = function(callback) {
  this.send_ping(callback); 
  if (!callback) {
    return this.recv_ping();
  }
};

PackratClient.prototype.send_ping = function(callback) {
  var args = new Packrat_ping_args();
  try {
    this.output.writeMessageBegin('ping', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_ping();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_ping = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_ping_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'ping failed: unknown result';
};

PackratClient.prototype.get_latest = function(callback) {
  this.send_get_latest(callback); 
  if (!callback) {
    return this.recv_get_latest();
  }
};

PackratClient.prototype.send_get_latest = function(callback) {
  var args = new Packrat_get_latest_args();
  try {
    this.output.writeMessageBegin('get_latest', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_get_latest();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_get_latest = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_get_latest_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'get_latest failed: unknown result';
};

PackratClient.prototype.allocate = function(callback) {
  this.send_allocate(callback); 
  if (!callback) {
    return this.recv_allocate();
  }
};

PackratClient.prototype.send_allocate = function(callback) {
  var args = new Packrat_allocate_args();
  try {
    this.output.writeMessageBegin('allocate', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_allocate();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_allocate = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_allocate_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'allocate failed: unknown result';
};

PackratClient.prototype.exists = function(packrat_id, callback) {
  this.send_exists(packrat_id, callback); 
  if (!callback) {
    return this.recv_exists();
  }
};

PackratClient.prototype.send_exists = function(packrat_id, callback) {
  var params = {
    packrat_id: packrat_id
  };
  var args = new Packrat_exists_args(params);
  try {
    this.output.writeMessageBegin('exists', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_exists();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_exists = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_exists_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'exists failed: unknown result';
};

PackratClient.prototype.get_keywords = function(packrat_id, callback) {
  this.send_get_keywords(packrat_id, callback); 
  if (!callback) {
    return this.recv_get_keywords();
  }
};

PackratClient.prototype.send_get_keywords = function(packrat_id, callback) {
  var params = {
    packrat_id: packrat_id
  };
  var args = new Packrat_get_keywords_args(params);
  try {
    this.output.writeMessageBegin('get_keywords', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_get_keywords();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_get_keywords = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_get_keywords_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'get_keywords failed: unknown result';
};

PackratClient.prototype.login = function(username, password, callback) {
  this.send_login(username, password, callback); 
  if (!callback) {
    return this.recv_login();
  }
};

PackratClient.prototype.send_login = function(username, password, callback) {
  var params = {
    username: username,
    password: password
  };
  var args = new Packrat_login_args(params);
  try {
    this.output.writeMessageBegin('login', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_login();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_login = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_login_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'login failed: unknown result';
};

PackratClient.prototype.validate_token = function(auth_token, callback) {
  this.send_validate_token(auth_token, callback); 
  if (!callback) {
    return this.recv_validate_token();
  }
};

PackratClient.prototype.send_validate_token = function(auth_token, callback) {
  var params = {
    auth_token: auth_token
  };
  var args = new Packrat_validate_token_args(params);
  try {
    this.output.writeMessageBegin('validate_token', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_validate_token();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_validate_token = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_validate_token_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.success) {
    return result.success;
  }
  throw 'validate_token failed: unknown result';
};

PackratClient.prototype.logout = function(auth_token, callback) {
  this.send_logout(auth_token, callback); 
};

PackratClient.prototype.send_logout = function(auth_token, callback) {
  var params = {
    auth_token: auth_token
  };
  var args = new Packrat_logout_args(params);
  try {
    this.output.writeMessageBegin('logout', Thrift.MessageType.ONEWAY, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      this.output.getTransport().flush(true, null);
      callback();
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.request_download = function(packratId, filename, auth_token, blockSize, callback) {
  this.send_request_download(packratId, filename, auth_token, blockSize, callback); 
  if (!callback) {
    return this.recv_request_download();
  }
};

PackratClient.prototype.send_request_download = function(packratId, filename, auth_token, blockSize, callback) {
  var params = {
    packratId: packratId,
    filename: filename,
    auth_token: auth_token,
    blockSize: blockSize
  };
  var args = new Packrat_request_download_args(params);
  try {
    this.output.writeMessageBegin('request_download', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_request_download();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_request_download = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_request_download_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsf) {
    throw result.nsf;
  }
  if (null !== result.np) {
    throw result.np;
  }
  if (null !== result.le) {
    throw result.le;
  }
  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'request_download failed: unknown result';
};

PackratClient.prototype.download_file_block = function(requestId, blockNumber, callback) {
  this.send_download_file_block(requestId, blockNumber, callback); 
  if (!callback) {
    return this.recv_download_file_block();
  }
};

PackratClient.prototype.send_download_file_block = function(requestId, blockNumber, callback) {
  var params = {
    requestId: requestId,
    blockNumber: blockNumber
  };
  var args = new Packrat_download_file_block_args(params);
  try {
    this.output.writeMessageBegin('download_file_block', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_download_file_block();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_download_file_block = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_download_file_block_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'download_file_block failed: unknown result';
};

PackratClient.prototype.next_file_block = function(requestId, callback) {
  this.send_next_file_block(requestId, callback); 
  if (!callback) {
    return this.recv_next_file_block();
  }
};

PackratClient.prototype.send_next_file_block = function(requestId, callback) {
  var params = {
    requestId: requestId
  };
  var args = new Packrat_next_file_block_args(params);
  try {
    this.output.writeMessageBegin('next_file_block', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_next_file_block();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_next_file_block = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_next_file_block_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'next_file_block failed: unknown result';
};

PackratClient.prototype.end_download = function(requestId, callback) {
  this.send_end_download(requestId, callback); 
};

PackratClient.prototype.send_end_download = function(requestId, callback) {
  var params = {
    requestId: requestId
  };
  var args = new Packrat_end_download_args(params);
  try {
    this.output.writeMessageBegin('end_download', Thrift.MessageType.ONEWAY, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      this.output.getTransport().flush(true, null);
      callback();
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.request_upload = function(info, auth_token, callback) {
  this.send_request_upload(info, auth_token, callback); 
  if (!callback) {
    return this.recv_request_upload();
  }
};

PackratClient.prototype.send_request_upload = function(info, auth_token, callback) {
  var params = {
    info: info,
    auth_token: auth_token
  };
  var args = new Packrat_request_upload_args(params);
  try {
    this.output.writeMessageBegin('request_upload', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_request_upload();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_request_upload = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_request_upload_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsf) {
    throw result.nsf;
  }
  if (null !== result.np) {
    throw result.np;
  }
  if (null !== result.le) {
    throw result.le;
  }
  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'request_upload failed: unknown result';
};

PackratClient.prototype.send_file_block = function(requestId, data, block_number, callback) {
  this.send_send_file_block(requestId, data, block_number, callback); 
  if (!callback) {
  this.recv_send_file_block();
  }
};

PackratClient.prototype.send_send_file_block = function(requestId, data, block_number, callback) {
  var params = {
    requestId: requestId,
    data: data,
    block_number: block_number
  };
  var args = new Packrat_send_file_block_args(params);
  try {
    this.output.writeMessageBegin('send_file_block', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_send_file_block();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_send_file_block = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_send_file_block_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.end_upload = function(requestId, callback) {
  this.send_end_upload(requestId, callback); 
  if (!callback) {
  this.recv_end_upload();
  }
};

PackratClient.prototype.send_end_upload = function(requestId, callback) {
  var params = {
    requestId: requestId
  };
  var args = new Packrat_end_upload_args(params);
  try {
    this.output.writeMessageBegin('end_upload', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_end_upload();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_end_upload = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_end_upload_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.it) {
    throw result.it;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.add_comment = function(packratId, comment, username, auth_token, callback) {
  this.send_add_comment(packratId, comment, username, auth_token, callback); 
  if (!callback) {
  this.recv_add_comment();
  }
};

PackratClient.prototype.send_add_comment = function(packratId, comment, username, auth_token, callback) {
  var params = {
    packratId: packratId,
    comment: comment,
    username: username,
    auth_token: auth_token
  };
  var args = new Packrat_add_comment_args(params);
  try {
    this.output.writeMessageBegin('add_comment', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_add_comment();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_add_comment = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_add_comment_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.le) {
    throw result.le;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.set_qa_status = function(packratId, qa_status, message, username, callback) {
  this.send_set_qa_status(packratId, qa_status, message, username, callback); 
  if (!callback) {
  this.recv_set_qa_status();
  }
};

PackratClient.prototype.send_set_qa_status = function(packratId, qa_status, message, username, callback) {
  var params = {
    packratId: packratId,
    qa_status: qa_status,
    message: message,
    username: username
  };
  var args = new Packrat_set_qa_status_args(params);
  try {
    this.output.writeMessageBegin('set_qa_status', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_set_qa_status();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_set_qa_status = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_set_qa_status_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ia) {
    throw result.ia;
  }
  if (null !== result.io) {
    throw result.io;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.set_uuid = function(packratId, uuid, callback) {
  this.send_set_uuid(packratId, uuid, callback); 
  if (!callback) {
  this.recv_set_uuid();
  }
};

PackratClient.prototype.send_set_uuid = function(packratId, uuid, callback) {
  var params = {
    packratId: packratId,
    uuid: uuid
  };
  var args = new Packrat_set_uuid_args(params);
  try {
    this.output.writeMessageBegin('set_uuid', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_set_uuid();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_set_uuid = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_set_uuid_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.already) {
    throw result.already;
  }
  if (null !== result.ia) {
    throw result.ia;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.get_attrs = function(packratId, attributes, callback) {
  this.send_get_attrs(packratId, attributes, callback); 
  if (!callback) {
    return this.recv_get_attrs();
  }
};

PackratClient.prototype.send_get_attrs = function(packratId, attributes, callback) {
  var params = {
    packratId: packratId,
    attributes: attributes
  };
  var args = new Packrat_get_attrs_args(params);
  try {
    this.output.writeMessageBegin('get_attrs', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_get_attrs();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_get_attrs = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_get_attrs_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ia) {
    throw result.ia;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'get_attrs failed: unknown result';
};

PackratClient.prototype.set_attrs = function(packratId, new_values, username, callback) {
  this.send_set_attrs(packratId, new_values, username, callback); 
  if (!callback) {
  this.recv_set_attrs();
  }
};

PackratClient.prototype.send_set_attrs = function(packratId, new_values, username, callback) {
  var params = {
    packratId: packratId,
    new_values: new_values,
    username: username
  };
  var args = new Packrat_set_attrs_args(params);
  try {
    this.output.writeMessageBegin('set_attrs', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_set_attrs();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_set_attrs = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_set_attrs_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ia) {
    throw result.ia;
  }
  if (null !== result.already) {
    throw result.already;
  }
  if (null !== result.io) {
    throw result.io;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  return;
};

PackratClient.prototype.list_files = function(packratId, callback) {
  this.send_list_files(packratId, callback); 
  if (!callback) {
    return this.recv_list_files();
  }
};

PackratClient.prototype.send_list_files = function(packratId, callback) {
  var params = {
    packratId: packratId
  };
  var args = new Packrat_list_files_args(params);
  try {
    this.output.writeMessageBegin('list_files', Thrift.MessageType.CALL, this.seqid);
    args.write(this.output);
    this.output.writeMessageEnd();
    if (callback) {
      var self = this;
      this.output.getTransport().flush(true, function() {
        var result = null;
        try {
          result = self.recv_list_files();
        } catch (e) {
          result = e;
        }
        callback(result);
      });
    } else {
      return this.output.getTransport().flush();
    }
  }
  catch (e) {
    if (typeof this.output.getTransport().reset === 'function') {
      this.output.getTransport().reset();
    }
    throw e;
  }
};

PackratClient.prototype.recv_list_files = function() {
  var ret = this.input.readMessageBegin();
  var mtype = ret.mtype;
  if (mtype == Thrift.MessageType.EXCEPTION) {
    var x = new Thrift.TApplicationException();
    x.read(this.input);
    this.input.readMessageEnd();
    throw x;
  }
  var result = new Packrat_list_files_result();
  result.read(this.input);
  this.input.readMessageEnd();

  if (null !== result.nsp) {
    throw result.nsp;
  }
  if (null !== result.ie) {
    throw result.ie;
  }
  if (null !== result.nsf) {
    throw result.nsf;
  }
  if (null !== result.success) {
    return result.success;
  }
  throw 'list_files failed: unknown result';
};



////http://sjc1uvt-packrat01.synaptics.com:8088/thrift.js

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*jshint evil:true*/

/**
 * The Thrift namespace houses the Apache Thrift JavaScript library
 * elements providing JavaScript bindings for the Apache Thrift RPC
 * system. End users will typically only directly make use of the
 * Transport (TXHRTransport/TWebSocketTransport) and Protocol
 * (TJSONPRotocol/TBinaryProtocol) constructors.
 *
 * Object methods beginning with a __ (e.g. __onOpen()) are internal
 * and should not be called outside of the object's own methods.
 *
 * This library creates one global object: Thrift
 * Code in this library must never create additional global identifiers,
 * all features must be scoped within the Thrift namespace.
 * @namespace
 * @example
 *     var transport = new Thrift.Transport('http://localhost:8585');
 *     var protocol  = new Thrift.Protocol(transport);
 *     var client = new MyThriftSvcClient(protocol);
 *     var result = client.MyMethod();
 */
var Thrift = {
    /**
     * Thrift JavaScript library version.
     * @readonly
     * @const {string} Version
     * @memberof Thrift
     */
    Version: '0.15.0',

    /**
     * Thrift IDL type string to Id mapping.
     * @readonly
     * @property {number}  STOP   - End of a set of fields.
     * @property {number}  VOID   - No value (only legal for return types).
     * @property {number}  BOOL   - True/False integer.
     * @property {number}  BYTE   - Signed 8 bit integer.
     * @property {number}  I08    - Signed 8 bit integer.
     * @property {number}  DOUBLE - 64 bit IEEE 854 floating point.
     * @property {number}  I16    - Signed 16 bit integer.
     * @property {number}  I32    - Signed 32 bit integer.
     * @property {number}  I64    - Signed 64 bit integer.
     * @property {number}  STRING - Array of bytes representing a string of characters.
     * @property {number}  UTF7   - Array of bytes representing a string of UTF7 encoded characters.
     * @property {number}  STRUCT - A multifield type.
     * @property {number}  MAP    - A collection type (map/associative-array/dictionary).
     * @property {number}  SET    - A collection type (unordered and without repeated values).
     * @property {number}  LIST   - A collection type (unordered).
     * @property {number}  UTF8   - Array of bytes representing a string of UTF8 encoded characters.
     * @property {number}  UTF16  - Array of bytes representing a string of UTF16 encoded characters.
     */
    Type: {
        STOP: 0,
        VOID: 1,
        BOOL: 2,
        BYTE: 3,
        I08: 3,
        DOUBLE: 4,
        I16: 6,
        I32: 8,
        I64: 10,
        STRING: 11,
        UTF7: 11,
        STRUCT: 12,
        MAP: 13,
        SET: 14,
        LIST: 15,
        UTF8: 16,
        UTF16: 17
    },

    /**
     * Thrift RPC message type string to Id mapping.
     * @readonly
     * @property {number}  CALL      - RPC call sent from client to server.
     * @property {number}  REPLY     - RPC call normal response from server to client.
     * @property {number}  EXCEPTION - RPC call exception response from server to client.
     * @property {number}  ONEWAY    - Oneway RPC call from client to server with no response.
     */
    MessageType: {
        CALL: 1,
        REPLY: 2,
        EXCEPTION: 3,
        ONEWAY: 4
    },

    /**
     * Utility function returning the count of an object's own properties.
     * @param {object} obj - Object to test.
     * @returns {number} number of object's own properties
     */
    objectLength: function(obj) {
        var length = 0;
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                length++;
            }
        }
        return length;
    },

    /**
     * Utility function to establish prototype inheritance.
     * @see {@link http://javascript.crockford.com/prototypal.html|Prototypal Inheritance}
     * @param {function} constructor - Contstructor function to set as derived.
     * @param {function} superConstructor - Contstructor function to set as base.
     * @param {string} [name] - Type name to set as name property in derived prototype.
     */
    inherits: function(constructor, superConstructor, name) {
      function F() {}
      F.prototype = superConstructor.prototype;
      constructor.prototype = new F();
      constructor.prototype.name = name || '';
    }
};

/**
 * Initializes a Thrift TException instance.
 * @constructor
 * @augments Error
 * @param {string} message - The TException message (distinct from the Error message).
 * @classdesc TException is the base class for all Thrift exceptions types.
 */
Thrift.TException = function(message) {
    this.message = message;
};
Thrift.inherits(Thrift.TException, Error, 'TException');

/**
 * Returns the message set on the exception.
 * @readonly
 * @returns {string} exception message
 */
Thrift.TException.prototype.getMessage = function() {
    return this.message;
};

/**
 * Thrift Application Exception type string to Id mapping.
 * @readonly
 * @property {number}  UNKNOWN                 - Unknown/undefined.
 * @property {number}  UNKNOWN_METHOD          - Client attempted to call a method unknown to the server.
 * @property {number}  INVALID_MESSAGE_TYPE    - Client passed an unknown/unsupported MessageType.
 * @property {number}  WRONG_METHOD_NAME       - Unused.
 * @property {number}  BAD_SEQUENCE_ID         - Unused in Thrift RPC, used to flag proprietary sequence number errors.
 * @property {number}  MISSING_RESULT          - Raised by a server processor if a handler fails to supply the required return result.
 * @property {number}  INTERNAL_ERROR          - Something bad happened.
 * @property {number}  PROTOCOL_ERROR          - The protocol layer failed to serialize or deserialize data.
 * @property {number}  INVALID_TRANSFORM       - Unused.
 * @property {number}  INVALID_PROTOCOL        - The protocol (or version) is not supported.
 * @property {number}  UNSUPPORTED_CLIENT_TYPE - Unused.
 */
Thrift.TApplicationExceptionType = {
    UNKNOWN: 0,
    UNKNOWN_METHOD: 1,
    INVALID_MESSAGE_TYPE: 2,
    WRONG_METHOD_NAME: 3,
    BAD_SEQUENCE_ID: 4,
    MISSING_RESULT: 5,
    INTERNAL_ERROR: 6,
    PROTOCOL_ERROR: 7,
    INVALID_TRANSFORM: 8,
    INVALID_PROTOCOL: 9,
    UNSUPPORTED_CLIENT_TYPE: 10
};

/**
 * Initializes a Thrift TApplicationException instance.
 * @constructor
 * @augments Thrift.TException
 * @param {string} message - The TApplicationException message (distinct from the Error message).
 * @param {Thrift.TApplicationExceptionType} [code] - The TApplicationExceptionType code.
 * @classdesc TApplicationException is the exception class used to propagate exceptions from an RPC server back to a calling client.
*/
Thrift.TApplicationException = function(message, code) {
    this.message = message;
    this.code = typeof code === 'number' ? code : 0;
};
Thrift.inherits(Thrift.TApplicationException, Thrift.TException, 'TApplicationException');

/**
 * Read a TApplicationException from the supplied protocol.
 * @param {object} input - The input protocol to read from.
 */
Thrift.TApplicationException.prototype.read = function(input) {
    while (1) {
        var ret = input.readFieldBegin();

        if (ret.ftype == Thrift.Type.STOP) {
            break;
        }

        var fid = ret.fid;

        switch (fid) {
            case 1:
                if (ret.ftype == Thrift.Type.STRING) {
                    ret = input.readString();
                    this.message = ret.value;
                } else {
                    ret = input.skip(ret.ftype);
                }
                break;
            case 2:
                if (ret.ftype == Thrift.Type.I32) {
                    ret = input.readI32();
                    this.code = ret.value;
                } else {
                    ret = input.skip(ret.ftype);
                }
                break;
           default:
                ret = input.skip(ret.ftype);
                break;
        }

        input.readFieldEnd();
    }

    input.readStructEnd();
};

/**
 * Wite a TApplicationException to the supplied protocol.
 * @param {object} output - The output protocol to write to.
 */
Thrift.TApplicationException.prototype.write = function(output) {
    output.writeStructBegin('TApplicationException');

    if (this.message) {
        output.writeFieldBegin('message', Thrift.Type.STRING, 1);
        output.writeString(this.getMessage());
        output.writeFieldEnd();
    }

    if (this.code) {
        output.writeFieldBegin('type', Thrift.Type.I32, 2);
        output.writeI32(this.code);
        output.writeFieldEnd();
    }

    output.writeFieldStop();
    output.writeStructEnd();
};

/**
 * Returns the application exception code set on the exception.
 * @readonly
 * @returns {Thrift.TApplicationExceptionType} exception code
 */
Thrift.TApplicationException.prototype.getCode = function() {
    return this.code;
};

Thrift.TProtocolExceptionType = {
    UNKNOWN: 0,
    INVALID_DATA: 1,
    NEGATIVE_SIZE: 2,
    SIZE_LIMIT: 3,
    BAD_VERSION: 4,
    NOT_IMPLEMENTED: 5,
    DEPTH_LIMIT: 6
};

Thrift.TProtocolException = function TProtocolException(type, message) {
    Error.call(this);
    if (Error.captureStackTrace !== undefined) {
        Error.captureStackTrace(this, this.constructor);
    }
    this.name = this.constructor.name;
    this.type = type;
    this.message = message;
};
Thrift.inherits(Thrift.TProtocolException, Thrift.TException, 'TProtocolException');

/**
 * Constructor Function for the XHR transport.
 * If you do not specify a url then you must handle XHR operations on
 * your own. This type can also be constructed using the Transport alias
 * for backward compatibility.
 * @constructor
 * @param {string} [url] - The URL to connect to.
 * @classdesc The Apache Thrift Transport layer performs byte level I/O
 * between RPC clients and servers. The JavaScript TXHRTransport object
 * uses Http[s]/XHR. Target servers must implement the http[s] transport
 * (see: node.js example server_http.js).
 * @example
 *     var transport = new Thrift.TXHRTransport("http://localhost:8585");
 */
Thrift.Transport = Thrift.TXHRTransport = function(url, options) {
    this.url = url;
    this.wpos = 0;
    this.rpos = 0;
    this.useCORS = (options && options.useCORS);
    this.customHeaders = options ? (options.customHeaders ? options.customHeaders : {}): {};
    this.send_buf = '';
    this.recv_buf = '';
};

Thrift.TXHRTransport.prototype = {
    /**
     * Gets the browser specific XmlHttpRequest Object.
     * @returns {object} the browser XHR interface object
     */
    getXmlHttpRequestObject: function() {
        try { return new XMLHttpRequest(); } catch (e1) { }
        try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch (e2) { }
        try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch (e3) { }

        throw "Your browser doesn't support XHR.";
    },

    /**
     * Sends the current XRH request if the transport was created with a URL
     * and the async parameter is false. If the transport was not created with
     * a URL, or the async parameter is True and no callback is provided, or
     * the URL is an empty string, the current send buffer is returned.
     * @param {object} async - If true the current send buffer is returned.
     * @param {object} callback - Optional async completion callback
     * @returns {undefined|string} Nothing or the current send buffer.
     * @throws {string} If XHR fails.
     */
    flush: function(async, callback) {
        var self = this;
        if ((async && !callback) || this.url === undefined || this.url === '') {
            return this.send_buf;
        }

        var xreq = this.getXmlHttpRequestObject();

        if (xreq.overrideMimeType) {
            xreq.overrideMimeType('application/vnd.apache.thrift.json; charset=utf-8');
        }

        if (callback) {
            //Ignore XHR callbacks until the data arrives, then call the
            //  client's callback
            xreq.onreadystatechange =
              (function() {
                var clientCallback = callback;
                return function() {
                  if (this.readyState == 4 && this.status == 200) {
                    self.setRecvBuffer(this.responseText);
                    clientCallback();
                  }
                };
              }());

            // detect net::ERR_CONNECTION_REFUSED and call the callback.
            xreq.onerror =
                (function() {
                  var clientCallback = callback;
                  return function() {
                      clientCallback();
                  };
                }());

        }

        xreq.open('POST', this.url, !!async);

        // add custom headers
        Object.keys(self.customHeaders).forEach(function(prop) {
            xreq.setRequestHeader(prop, self.customHeaders[prop]);
        });

        if (xreq.setRequestHeader) {
            xreq.setRequestHeader('Accept', 'application/vnd.apache.thrift.json; charset=utf-8');
            xreq.setRequestHeader('Content-Type', 'application/vnd.apache.thrift.json; charset=utf-8');
        }

        xreq.send(this.send_buf);
        if (async && callback) {
            return;
        }

        if (xreq.readyState != 4) {
            throw 'encountered an unknown ajax ready state: ' + xreq.readyState;
        }

        if (xreq.status != 200) {
            throw 'encountered a unknown request status: ' + xreq.status;
        }

        this.recv_buf = xreq.responseText;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Creates a jQuery XHR object to be used for a Thrift server call.
     * @param {object} client - The Thrift Service client object generated by the IDL compiler.
     * @param {object} postData - The message to send to the server.
     * @param {function} args - The original call arguments with the success call back at the end.
     * @param {function} recv_method - The Thrift Service Client receive method for the call.
     * @returns {object} A new jQuery XHR object.
     * @throws {string} If the jQuery version is prior to 1.5 or if jQuery is not found.
     */
    jqRequest: function(client, postData, args, recv_method) {
        if (typeof jQuery === 'undefined' ||
            typeof jQuery.Deferred === 'undefined') {
            throw 'Thrift.js requires jQuery 1.5+ to use asynchronous requests';
        }

        var thriftTransport = this;

        var jqXHR = jQuery.ajax({
            url: this.url,
            data: postData,
            type: 'POST',
            cache: false,
            contentType: 'application/vnd.apache.thrift.json; charset=utf-8',
            dataType: 'text thrift',
            converters: {
                'text thrift' : function(responseData) {
                    thriftTransport.setRecvBuffer(responseData);
                    var value = recv_method.call(client);
                    return value;
                }
            },
            context: client,
            success: jQuery.makeArray(args).pop(),
            beforeSend: function (xreq) {
                Object.keys(thriftTransport.customHeaders).forEach(function (prop) {
                    xreq.setRequestHeader(prop, thriftTransport.customHeaders[prop]);
                });
            }
        });

        return jqXHR;
    },

    /**
     * Sets the buffer to provide the protocol when deserializing.
     * @param {string} buf - The buffer to supply the protocol.
     */
    setRecvBuffer: function(buf) {
        this.recv_buf = buf;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Returns true if the transport is open, XHR always returns true.
     * @readonly
     * @returns {boolean} Always True.
     */
    isOpen: function() {
        return true;
    },

    /**
     * Opens the transport connection, with XHR this is a nop.
     */
    open: function() {},

    /**
     * Closes the transport connection, with XHR this is a nop.
     */
    close: function() {},

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read: function(len) {
        var avail = this.wpos - this.rpos;

        if (avail === 0) {
            return '';
        }

        var give = len;

        if (avail < len) {
            give = avail;
        }

        var ret = this.read_buf.substr(this.rpos, give);
        this.rpos += give;

        //clear buf when complete?
        return ret;
    },

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll: function() {
        return this.recv_buf;
    },

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write: function(buf) {
        this.send_buf = buf;
    },

    /**
     * Returns the send buffer.
     * @readonly
     * @returns {string} The send buffer.
     */
    getSendBuffer: function() {
        return this.send_buf;
    }

};


/**
 * Constructor Function for the WebSocket transport.
 * @constructor
 * @param {string} [url] - The URL to connect to.
 * @classdesc The Apache Thrift Transport layer performs byte level I/O
 * between RPC clients and servers. The JavaScript TWebSocketTransport object
 * uses the WebSocket protocol. Target servers must implement WebSocket.
 * (see: node.js example server_http.js).
 * @example
 *   var transport = new Thrift.TWebSocketTransport("http://localhost:8585");
 */
Thrift.TWebSocketTransport = function(url) {
    this.__reset(url);
};

Thrift.TWebSocketTransport.prototype = {
    __reset: function(url) {
      this.url = url;             //Where to connect
      this.socket = null;         //The web socket
      this.callbacks = [];        //Pending callbacks
      this.send_pending = [];     //Buffers/Callback pairs waiting to be sent
      this.send_buf = '';         //Outbound data, immutable until sent
      this.recv_buf = '';         //Inbound data
      this.rb_wpos = 0;           //Network write position in receive buffer
      this.rb_rpos = 0;           //Client read position in receive buffer
    },

    /**
     * Sends the current WS request and registers callback. The async
     * parameter is ignored (WS flush is always async) and the callback
     * function parameter is required.
     * @param {object} async - Ignored.
     * @param {object} callback - The client completion callback.
     * @returns {undefined|string} Nothing (undefined)
     */
    flush: function(async, callback) {
      var self = this;
      if (this.isOpen()) {
        //Send data and register a callback to invoke the client callback
        this.socket.send(this.send_buf);
        this.callbacks.push((function() {
          var clientCallback = callback;
          return function(msg) {
            self.setRecvBuffer(msg);
            if (clientCallback) {
                clientCallback();
            }
          };
        }()));
      } else {
        //Queue the send to go out __onOpen
        this.send_pending.push({
          buf: this.send_buf,
          cb: callback
        });
      }
    },

    __onOpen: function() {
       var self = this;
       if (this.send_pending.length > 0) {
          //If the user made calls before the connection was fully
          //open, send them now
          this.send_pending.forEach(function(elem) {
             self.socket.send(elem.buf);
             self.callbacks.push((function() {
               var clientCallback = elem.cb;
               return function(msg) {
                  self.setRecvBuffer(msg);
                  clientCallback();
               };
             }()));
          });
          this.send_pending = [];
       }
    },

    __onClose: function(evt) {
      this.__reset(this.url);
    },

    __onMessage: function(evt) {
      if (this.callbacks.length) {
        this.callbacks.shift()(evt.data);
      }
    },

    __onError: function(evt) {
      console.log('Thrift WebSocket Error: ' + evt.toString());
      this.socket.close();
    },

    /**
     * Sets the buffer to use when receiving server responses.
     * @param {string} buf - The buffer to receive server responses.
     */
    setRecvBuffer: function(buf) {
        this.recv_buf = buf;
        this.recv_buf_sz = this.recv_buf.length;
        this.wpos = this.recv_buf.length;
        this.rpos = 0;
    },

    /**
     * Returns true if the transport is open
     * @readonly
     * @returns {boolean}
     */
    isOpen: function() {
        return this.socket && this.socket.readyState == this.socket.OPEN;
    },

    /**
     * Opens the transport connection
     */
    open: function() {
      //If OPEN/CONNECTING/CLOSING ignore additional opens
      if (this.socket && this.socket.readyState != this.socket.CLOSED) {
        return;
      }
      //If there is no socket or the socket is closed:
      this.socket = new WebSocket(this.url);
      this.socket.onopen = this.__onOpen.bind(this);
      this.socket.onmessage = this.__onMessage.bind(this);
      this.socket.onerror = this.__onError.bind(this);
      this.socket.onclose = this.__onClose.bind(this);
    },

    /**
     * Closes the transport connection
     */
    close: function() {
      this.socket.close();
    },

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read: function(len) {
        var avail = this.wpos - this.rpos;

        if (avail === 0) {
            return '';
        }

        var give = len;

        if (avail < len) {
            give = avail;
        }

        var ret = this.read_buf.substr(this.rpos, give);
        this.rpos += give;

        //clear buf when complete?
        return ret;
    },

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll: function() {
        return this.recv_buf;
    },

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write: function(buf) {
        this.send_buf = buf;
    },

    /**
     * Returns the send buffer.
     * @readonly
     * @returns {string} The send buffer.
     */
    getSendBuffer: function() {
        return this.send_buf;
    }

};

/**
 * Initializes a Thrift JSON protocol instance.
 * @constructor
 * @param {Thrift.Transport} transport - The transport to serialize to/from.
 * @classdesc Apache Thrift Protocols perform serialization which enables cross
 * language RPC. The Protocol type is the JavaScript browser implementation
 * of the Apache Thrift TJSONProtocol.
 * @example
 *     var protocol  = new Thrift.Protocol(transport);
 */
Thrift.TJSONProtocol = Thrift.Protocol = function(transport) {
    this.tstack = [];
    this.tpos = [];
    this.transport = transport;
};

/**
 * Thrift IDL type Id to string mapping.
 * @readonly
 * @see {@link Thrift.Type}
 */
Thrift.Protocol.Type = {};
Thrift.Protocol.Type[Thrift.Type.BOOL] = '"tf"';
Thrift.Protocol.Type[Thrift.Type.BYTE] = '"i8"';
Thrift.Protocol.Type[Thrift.Type.I16] = '"i16"';
Thrift.Protocol.Type[Thrift.Type.I32] = '"i32"';
Thrift.Protocol.Type[Thrift.Type.I64] = '"i64"';
Thrift.Protocol.Type[Thrift.Type.DOUBLE] = '"dbl"';
Thrift.Protocol.Type[Thrift.Type.STRUCT] = '"rec"';
Thrift.Protocol.Type[Thrift.Type.STRING] = '"str"';
Thrift.Protocol.Type[Thrift.Type.MAP] = '"map"';
Thrift.Protocol.Type[Thrift.Type.LIST] = '"lst"';
Thrift.Protocol.Type[Thrift.Type.SET] = '"set"';

/**
 * Thrift IDL type string to Id mapping.
 * @readonly
 * @see {@link Thrift.Type}
 */
Thrift.Protocol.RType = {};
Thrift.Protocol.RType.tf = Thrift.Type.BOOL;
Thrift.Protocol.RType.i8 = Thrift.Type.BYTE;
Thrift.Protocol.RType.i16 = Thrift.Type.I16;
Thrift.Protocol.RType.i32 = Thrift.Type.I32;
Thrift.Protocol.RType.i64 = Thrift.Type.I64;
Thrift.Protocol.RType.dbl = Thrift.Type.DOUBLE;
Thrift.Protocol.RType.rec = Thrift.Type.STRUCT;
Thrift.Protocol.RType.str = Thrift.Type.STRING;
Thrift.Protocol.RType.map = Thrift.Type.MAP;
Thrift.Protocol.RType.lst = Thrift.Type.LIST;
Thrift.Protocol.RType.set = Thrift.Type.SET;

/**
 * The TJSONProtocol version number.
 * @readonly
 * @const {number} Version
 * @memberof Thrift.Protocol
 */
 Thrift.Protocol.Version = 1;

Thrift.Protocol.prototype = {
    /**
     * Returns the underlying transport.
     * @readonly
     * @returns {Thrift.Transport} The underlying transport.
     */
    getTransport: function() {
        return this.transport;
    },

    /**
     * Serializes the beginning of a Thrift RPC message.
     * @param {string} name - The service method to call.
     * @param {Thrift.MessageType} messageType - The type of method call.
     * @param {number} seqid - The sequence number of this call (always 0 in Apache Thrift).
     */
    writeMessageBegin: function(name, messageType, seqid) {
        this.tstack = [];
        this.tpos = [];

        this.tstack.push([Thrift.Protocol.Version, '"' +
            name + '"', messageType, seqid]);
    },

    /**
     * Serializes the end of a Thrift RPC message.
     */
    writeMessageEnd: function() {
        var obj = this.tstack.pop();

        this.wobj = this.tstack.pop();
        this.wobj.push(obj);

        this.wbuf = '[' + this.wobj.join(',') + ']';

        this.transport.write(this.wbuf);
     },


    /**
     * Serializes the beginning of a struct.
     * @param {string} name - The name of the struct.
     */
    writeStructBegin: function(name) {
        this.tpos.push(this.tstack.length);
        this.tstack.push({});
    },

    /**
     * Serializes the end of a struct.
     */
    writeStructEnd: function() {

        var p = this.tpos.pop();
        var struct = this.tstack[p];
        var str = '{';
        var first = true;
        for (var key in struct) {
            if (first) {
                first = false;
            } else {
                str += ',';
            }

            str += key + ':' + struct[key];
        }

        str += '}';
        this.tstack[p] = str;
    },

    /**
     * Serializes the beginning of a struct field.
     * @param {string} name - The name of the field.
     * @param {Thrift.Protocol.Type} fieldType - The data type of the field.
     * @param {number} fieldId - The field's unique identifier.
     */
    writeFieldBegin: function(name, fieldType, fieldId) {
        this.tpos.push(this.tstack.length);
        this.tstack.push({ 'fieldId': '"' +
            fieldId + '"', 'fieldType': Thrift.Protocol.Type[fieldType]
        });

    },

    /**
     * Serializes the end of a field.
     */
    writeFieldEnd: function() {
        var value = this.tstack.pop();
        var fieldInfo = this.tstack.pop();

        this.tstack[this.tstack.length - 1][fieldInfo.fieldId] = '{' +
            fieldInfo.fieldType + ':' + value + '}';
        this.tpos.pop();
    },

    /**
     * Serializes the end of the set of fields for a struct.
     */
    writeFieldStop: function() {
        //na
    },

    /**
     * Serializes the beginning of a map collection.
     * @param {Thrift.Type} keyType - The data type of the key.
     * @param {Thrift.Type} valType - The data type of the value.
     * @param {number} [size] - The number of elements in the map (ignored).
     */
    writeMapBegin: function(keyType, valType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[keyType],
            Thrift.Protocol.Type[valType], 0]);
    },

    /**
     * Serializes the end of a map.
     */
    writeMapEnd: function() {
        var p = this.tpos.pop();

        if (p == this.tstack.length) {
            return;
        }

        if ((this.tstack.length - p - 1) % 2 !== 0) {
            this.tstack.push('');
        }

        var size = (this.tstack.length - p - 1) / 2;

        this.tstack[p][this.tstack[p].length - 1] = size;

        var map = '}';
        var first = true;
        while (this.tstack.length > p + 1) {
            var v = this.tstack.pop();
            var k = this.tstack.pop();
            if (first) {
                first = false;
            } else {
                map = ',' + map;
            }

            if (! isNaN(k)) { k = '"' + k + '"'; } //json "keys" need to be strings
            map = k + ':' + v + map;
        }
        map = '{' + map;

        this.tstack[p].push(map);
        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /**
     * Serializes the beginning of a list collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeListBegin: function(elemType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[elemType], size]);
    },

    /**
     * Serializes the end of a list.
     */
    writeListEnd: function() {
        var p = this.tpos.pop();

        while (this.tstack.length > p + 1) {
            var tmpVal = this.tstack[p + 1];
            this.tstack.splice(p + 1, 1);
            this.tstack[p].push(tmpVal);
        }

        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /**
     * Serializes the beginning of a set collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeSetBegin: function(elemType, size) {
        this.tpos.push(this.tstack.length);
        this.tstack.push([Thrift.Protocol.Type[elemType], size]);
    },

    /**
     * Serializes the end of a set.
     */
    writeSetEnd: function() {
        var p = this.tpos.pop();

        while (this.tstack.length > p + 1) {
            var tmpVal = this.tstack[p + 1];
            this.tstack.splice(p + 1, 1);
            this.tstack[p].push(tmpVal);
        }

        this.tstack[p] = '[' + this.tstack[p].join(',') + ']';
    },

    /** Serializes a boolean */
    writeBool: function(value) {
        this.tstack.push(value ? 1 : 0);
    },

    /** Serializes a number */
    writeByte: function(i8) {
        this.tstack.push(i8);
    },

    /** Serializes a number */
    writeI16: function(i16) {
        this.tstack.push(i16);
    },

    /** Serializes a number */
    writeI32: function(i32) {
        this.tstack.push(i32);
    },

    /** Serializes a number */
    writeI64: function(i64) {
        if (typeof i64 === 'number') {
            this.tstack.push(i64);
        } else {
            this.tstack.push(Int64Util.toDecimalString(i64));
        }
    },

    /** Serializes a number */
    writeDouble: function(dbl) {
        this.tstack.push(dbl);
    },

    /** Serializes a string */
    writeString: function(str) {
        // We do not encode uri components for wire transfer:
        if (str === null) {
            this.tstack.push(null);
        } else {
            // concat may be slower than building a byte buffer
            var escapedString = '';
            for (var i = 0; i < str.length; i++) {
                var ch = str.charAt(i);      // a single double quote: "
                if (ch === '\"') {
                    escapedString += '\\\"'; // write out as: \"
                } else if (ch === '\\') {    // a single backslash
                    escapedString += '\\\\'; // write out as double backslash
                } else if (ch === '\b') {    // a single backspace: invisible
                    escapedString += '\\b';  // write out as: \b"
                } else if (ch === '\f') {    // a single formfeed: invisible
                    escapedString += '\\f';  // write out as: \f"
                } else if (ch === '\n') {    // a single newline: invisible
                    escapedString += '\\n';  // write out as: \n"
                } else if (ch === '\r') {    // a single return: invisible
                    escapedString += '\\r';  // write out as: \r"
                } else if (ch === '\t') {    // a single tab: invisible
                    escapedString += '\\t';  // write out as: \t"
                } else {
                    escapedString += ch;     // Else it need not be escaped
                }
            }
            this.tstack.push('"' + escapedString + '"');
        }
    },

    /** Serializes a string */
    writeBinary: function(binary) {
        var str = '';
        if (typeof binary == 'string') {
            str = binary;
        } else if (binary instanceof Uint8Array) {
            var arr = binary;
            for (var i = 0; i < arr.length; ++i) {
                str += String.fromCharCode(arr[i]);
            }
        } else {
            throw new TypeError('writeBinary only accepts String or Uint8Array.');
        }
        this.tstack.push('"' + btoa(str) + '"');
    },

    /**
       @class
       @name AnonReadMessageBeginReturn
       @property {string} fname - The name of the service method.
       @property {Thrift.MessageType} mtype - The type of message call.
       @property {number} rseqid - The sequence number of the message (0 in Thrift RPC).
     */
    /**
     * Deserializes the beginning of a message.
     * @returns {AnonReadMessageBeginReturn}
     */
    readMessageBegin: function() {
        this.rstack = [];
        this.rpos = [];

        var received = this.transport.readAll();

        if (typeof JSONInt64 !== 'undefined' && typeof JSONInt64.parse === 'function') {
            this.robj = JSONInt64.parse(received);
        } else if (typeof JSON !== 'undefined' && typeof JSON.parse === 'function') {
            this.robj = JSON.parse(received);
        } else if (typeof jQuery !== 'undefined') {
            this.robj = jQuery.parseJSON(received);
        } else {
            this.robj = eval(received);
        }

        var r = {};
        var version = this.robj.shift();

        if (version != Thrift.Protocol.Version) {
            throw 'Wrong thrift protocol version: ' + version;
        }

        r.fname = this.robj.shift();
        r.mtype = this.robj.shift();
        r.rseqid = this.robj.shift();


        //get to the main obj
        this.rstack.push(this.robj.shift());

        return r;
    },

    /** Deserializes the end of a message. */
    readMessageEnd: function() {
    },

    /**
     * Deserializes the beginning of a struct.
     * @param {string} [name] - The name of the struct (ignored)
     * @returns {object} - An object with an empty string fname property
     */
    readStructBegin: function(name) {
        var r = {};
        r.fname = '';

        //incase this is an array of structs
        if (this.rstack[this.rstack.length - 1] instanceof Array) {
            this.rstack.push(this.rstack[this.rstack.length - 1].shift());
        }

        return r;
    },

    /** Deserializes the end of a struct. */
    readStructEnd: function() {
        if (this.rstack[this.rstack.length - 2] instanceof Array) {
            this.rstack.pop();
        }
    },

    /**
       @class
       @name AnonReadFieldBeginReturn
       @property {string} fname - The name of the field (always '').
       @property {Thrift.Type} ftype - The data type of the field.
       @property {number} fid - The unique identifier of the field.
     */
    /**
     * Deserializes the beginning of a field.
     * @returns {AnonReadFieldBeginReturn}
     */
    readFieldBegin: function() {
        var r = {};

        var fid = -1;
        var ftype = Thrift.Type.STOP;

        //get a fieldId
        for (var f in (this.rstack[this.rstack.length - 1])) {
            if (f === null) {
              continue;
            }

            fid = parseInt(f, 10);
            this.rpos.push(this.rstack.length);

            var field = this.rstack[this.rstack.length - 1][fid];

            //remove so we don't see it again
            delete this.rstack[this.rstack.length - 1][fid];

            this.rstack.push(field);

            break;
        }

        if (fid != -1) {

            //should only be 1 of these but this is the only
            //way to match a key
            for (var i in (this.rstack[this.rstack.length - 1])) {
                if (Thrift.Protocol.RType[i] === null) {
                    continue;
                }

                ftype = Thrift.Protocol.RType[i];
                this.rstack[this.rstack.length - 1] =
                    this.rstack[this.rstack.length - 1][i];
            }
        }

        r.fname = '';
        r.ftype = ftype;
        r.fid = fid;

        return r;
    },

    /** Deserializes the end of a field. */
    readFieldEnd: function() {
        var pos = this.rpos.pop();

        //get back to the right place in the stack
        while (this.rstack.length > pos) {
            this.rstack.pop();
        }

    },

    /**
       @class
       @name AnonReadMapBeginReturn
       @property {Thrift.Type} ktype - The data type of the key.
       @property {Thrift.Type} vtype - The data type of the value.
       @property {number} size - The number of elements in the map.
     */
    /**
     * Deserializes the beginning of a map.
     * @returns {AnonReadMapBeginReturn}
     */
    readMapBegin: function() {
        var map = this.rstack.pop();
        var first = map.shift();
        if (first instanceof Array) {
          this.rstack.push(map);
          map = first;
          first = map.shift();
        }

        var r = {};
        r.ktype = Thrift.Protocol.RType[first];
        r.vtype = Thrift.Protocol.RType[map.shift()];
        r.size = map.shift();

        this.rpos.push(this.rstack.length);
        this.rstack.push(map.shift());

        return r;
    },

    /** Deserializes the end of a map. */
    readMapEnd: function() {
        this.readFieldEnd();
    },

    /**
       @class
       @name AnonReadColBeginReturn
       @property {Thrift.Type} etype - The data type of the element.
       @property {number} size - The number of elements in the collection.
     */
    /**
     * Deserializes the beginning of a list.
     * @returns {AnonReadColBeginReturn}
     */
    readListBegin: function() {
        var list = this.rstack[this.rstack.length - 1];

        var r = {};
        r.etype = Thrift.Protocol.RType[list.shift()];
        r.size = list.shift();

        this.rpos.push(this.rstack.length);
        this.rstack.push(list.shift());

        return r;
    },

    /** Deserializes the end of a list. */
    readListEnd: function() {
        var pos = this.rpos.pop() - 2;
        var st = this.rstack;
        st.pop();
        if (st instanceof Array && st.length > pos && st[pos].length > 0) {
          st.push(st[pos].shift());
        }
    },

    /**
     * Deserializes the beginning of a set.
     * @returns {AnonReadColBeginReturn}
     */
    readSetBegin: function(elemType, size) {
        return this.readListBegin(elemType, size);
    },

    /** Deserializes the end of a set. */
    readSetEnd: function() {
        return this.readListEnd();
    },

    /** Returns an object with a value property set to
     *  False unless the next number in the protocol buffer
     *  is 1, in which case the value property is True */
    readBool: function() {
        var r = this.readI32();

        if (r !== null && r.value == '1') {
            r.value = true;
        } else {
            r.value = false;
        }

        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readByte: function() {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI16: function() {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI32: function(f) {
        if (f === undefined) {
            f = this.rstack[this.rstack.length - 1];
        }

        var r = {};

        if (f instanceof Array) {
            if (f.length === 0) {
                r.value = undefined;
            } else {
                if (!f.isReversed) {
                    f.reverse();
                    f.isReversed = true;
                }
                r.value = f.pop();
            }
        } else if (f instanceof Object) {
           for (var i in f) {
                if (i === null) {
                  continue;
                }
                this.rstack.push(f[i]);
                delete f[i];

                r.value = i;
                break;
           }
        } else {
            r.value = f;
            this.rstack.pop();
        }

        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readI64: function(f) {
        if (f === undefined) {
            f = this.rstack[this.rstack.length - 1];
        }

        var r = {};

        if (f instanceof Array) {
            if (f.length === 0) {
                r.value = undefined;
            } else {
                if (!f.isReversed) {
                    f.reverse();
                    f.isReversed = true;
                }
                r.value = f.pop();
            }
        } else if (f instanceof Object) {
            var int64Object = true;
            var objectKeys = Object.keys(f).sort();
            var int64Keys = ['buffer', 'offset'];
            if (objectKeys.length !== int64Keys.length) {
                int64Object = false;
            }
            for (var it=0; int64Object && it < objectKeys.length; ++it) {
                if (objectKeys[it] !== int64Keys[it]) {
                    int64Object = false;
                }
            }
            if (int64Object) {
                r.value = f;
            } else {
                for (var i in f) {
                    if (i === null) {
                    continue;
                    }
                    this.rstack.push(f[i]);
                    delete f[i];

                    r.value = i;
                    break;
                }
            }
        } else {
            r.value = f;
            this.rstack.pop();
        }
        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readDouble: function() {
        return this.readI32();
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readString: function() {
        var r = this.readI32();
        return r;
    },

    /** Returns the an object with a value property set to the
        next value found in the protocol buffer */
    readBinary: function() {
        var r = this.readI32();
        r.value = atob(r.value);
        return r;
    },

    /**
     * Method to arbitrarily skip over data */
    skip: function(type) {
        var ret, i;
        switch (type) {
            case Thrift.Type.BOOL:
                return this.readBool();

            case Thrift.Type.BYTE:
                return this.readByte();

            case Thrift.Type.I16:
                return this.readI16();

            case Thrift.Type.I32:
                return this.readI32();

            case Thrift.Type.I64:
                return this.readI64();

            case Thrift.Type.DOUBLE:
                return this.readDouble();

            case Thrift.Type.STRING:
                return this.readString();

            case Thrift.Type.STRUCT:
                this.readStructBegin();
                while (true) {
                    ret = this.readFieldBegin();
                    if (ret.ftype == Thrift.Type.STOP) {
                        break;
                    }
                    this.skip(ret.ftype);
                    this.readFieldEnd();
                }
                this.readStructEnd();
                return null;

            case Thrift.Type.MAP:
                ret = this.readMapBegin();
                for (i = 0; i < ret.size; i++) {
                    if (i > 0) {
                        if (this.rstack.length > this.rpos[this.rpos.length - 1] + 1) {
                            this.rstack.pop();
                        }
                    }
                    this.skip(ret.ktype);
                    this.skip(ret.vtype);
                }
                this.readMapEnd();
                return null;

            case Thrift.Type.SET:
                ret = this.readSetBegin();
                for (i = 0; i < ret.size; i++) {
                    this.skip(ret.etype);
                }
                this.readSetEnd();
                return null;

            case Thrift.Type.LIST:
                ret = this.readListBegin();
                for (i = 0; i < ret.size; i++) {
                    this.skip(ret.etype);
                }
                this.readListEnd();
                return null;

            default:
                throw new Thrift.TProtocolException(Thrift.TProtocolExceptionType.INVALID_DATA);
        }
    }
};


/**
 * Initializes a MutilplexProtocol Implementation as a Wrapper for Thrift.Protocol
 * @constructor
 */
Thrift.MultiplexProtocol = function(srvName, trans, strictRead, strictWrite) {
    Thrift.Protocol.call(this, trans, strictRead, strictWrite);
    this.serviceName = srvName;
};
Thrift.inherits(Thrift.MultiplexProtocol, Thrift.Protocol, 'multiplexProtocol');

/** Override writeMessageBegin method of prototype*/
Thrift.MultiplexProtocol.prototype.writeMessageBegin = function(name, type, seqid) {

    if (type === Thrift.MessageType.CALL || type === Thrift.MessageType.ONEWAY) {
        Thrift.Protocol.prototype.writeMessageBegin.call(this, this.serviceName + ':' + name, type, seqid);
    } else {
        Thrift.Protocol.prototype.writeMessageBegin.call(this, name, type, seqid);
    }
};

Thrift.Multiplexer = function() {
    this.seqid = 0;
};

/** Instantiates a multiplexed client for a specific service
 * @constructor
 * @param {String} serviceName - The transport to serialize to/from.
 * @param {Thrift.ServiceClient} SCl - The Service Client Class
 * @param {Thrift.Transport} transport - Thrift.Transport instance which provides remote host:port
 * @example
 *    var mp = new Thrift.Multiplexer();
 *    var transport = new Thrift.Transport("http://localhost:9090/foo.thrift");
 *    var protocol = new Thrift.Protocol(transport);
 *    var client = mp.createClient('AuthService', AuthServiceClient, transport);
*/
Thrift.Multiplexer.prototype.createClient = function(serviceName, SCl, transport) {
    if (SCl.Client) {
        SCl = SCl.Client;
    }
    var self = this;
    SCl.prototype.new_seqid = function() {
        self.seqid += 1;
        return self.seqid;
    };
    var client = new SCl(new Thrift.MultiplexProtocol(serviceName, transport));

    return client;
};



var copyList, copyMap;

copyList = function(lst, types) {

  if (!lst) {return lst; }

  var type;

  if (types.shift === undefined) {
    type = types;
  }
  else {
    type = types[0];
  }
  var Type = type;

  var len = lst.length, result = [], i, val;
  for (i = 0; i < len; i++) {
    val = lst[i];
    if (type === null) {
      result.push(val);
    }
    else if (type === copyMap || type === copyList) {
      result.push(type(val, types.slice(1)));
    }
    else {
      result.push(new Type(val));
    }
  }
  return result;
};

copyMap = function(obj, types) {

  if (!obj) {return obj; }

  var type;

  if (types.shift === undefined) {
    type = types;
  }
  else {
    type = types[0];
  }
  var Type = type;

  var result = {}, val;
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      val = obj[prop];
      if (type === null) {
        result[prop] = val;
      }
      else if (type === copyMap || type === copyList) {
        result[prop] = type(val, types.slice(1));
      }
      else {
        result[prop] = new Type(val);
      }
    }
  }
  return result;
};

Thrift.copyMap = copyMap;
Thrift.copyList = copyList;






////http://sjc1uvt-packrat01.synaptics.com:8088/packrat_types.js

//
// Autogenerated by Thrift Compiler (0.15.0)
//
// DO NOT EDIT UNLESS YOU ARE SURE THAT YOU KNOW WHAT YOU ARE DOING
//
if (typeof Int64 === 'undefined' && typeof require === 'function') {
  var Int64 = require('node-int64');
}


var InfoType = {
  'PACKRAT_ID' : 1,
  'UUID' : 2,
  'QA_STATUS' : 3,
  'QA_WAIVER' : 4,
  'QA_ISSUE' : 5,
  'SOURCE_STATUS' : 6,
  'TRACEABILITY_TAG' : 7,
  'HEX_FILE' : 8,
  'CHECKSUM' : 9
};

var NoSuchPackrat = function(args) {
  this.packrat_id = null;
  if (args) {
    if (args.packrat_id !== undefined && args.packrat_id !== null) {
      this.packrat_id = args.packrat_id;
    }
  }
};
Thrift.inherits(NoSuchPackrat, Thrift.TException);
NoSuchPackrat.prototype.name = 'NoSuchPackrat';
NoSuchPackrat.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packrat_id = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

NoSuchPackrat.prototype.write = function(output) {
  output.writeStructBegin('NoSuchPackrat');
  if (this.packrat_id !== null && this.packrat_id !== undefined) {
    output.writeFieldBegin('packrat_id', Thrift.Type.I32, 1);
    output.writeI32(this.packrat_id);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var NotImplemented = function(args) {
  this.function_name = null;
  if (args) {
    if (args.function_name !== undefined && args.function_name !== null) {
      this.function_name = args.function_name;
    }
  }
};
Thrift.inherits(NotImplemented, Thrift.TException);
NotImplemented.prototype.name = 'NotImplemented';
NotImplemented.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.function_name = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

NotImplemented.prototype.write = function(output) {
  output.writeStructBegin('NotImplemented');
  if (this.function_name !== null && this.function_name !== undefined) {
    output.writeFieldBegin('function_name', Thrift.Type.STRING, 1);
    output.writeString(this.function_name);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var LoginException = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(LoginException, Thrift.TException);
LoginException.prototype.name = 'LoginException';
LoginException.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

LoginException.prototype.write = function(output) {
  output.writeStructBegin('LoginException');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var NoSuchFile = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(NoSuchFile, Thrift.TException);
NoSuchFile.prototype.name = 'NoSuchFile';
NoSuchFile.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

NoSuchFile.prototype.write = function(output) {
  output.writeStructBegin('NoSuchFile');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var HashError = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(HashError, Thrift.TException);
HashError.prototype.name = 'HashError';
HashError.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

HashError.prototype.write = function(output) {
  output.writeStructBegin('HashError');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var IllegalOperation = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(IllegalOperation, Thrift.TException);
IllegalOperation.prototype.name = 'IllegalOperation';
IllegalOperation.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

IllegalOperation.prototype.write = function(output) {
  output.writeStructBegin('IllegalOperation');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var InvalidTransfer = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(InvalidTransfer, Thrift.TException);
InvalidTransfer.prototype.name = 'InvalidTransfer';
InvalidTransfer.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

InvalidTransfer.prototype.write = function(output) {
  output.writeStructBegin('InvalidTransfer');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var InternalError = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(InternalError, Thrift.TException);
InternalError.prototype.name = 'InternalError';
InternalError.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

InternalError.prototype.write = function(output) {
  output.writeStructBegin('InternalError');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var NotPermitted = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(NotPermitted, Thrift.TException);
NotPermitted.prototype.name = 'NotPermitted';
NotPermitted.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

NotPermitted.prototype.write = function(output) {
  output.writeStructBegin('NotPermitted');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var InvalidArgument = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(InvalidArgument, Thrift.TException);
InvalidArgument.prototype.name = 'InvalidArgument';
InvalidArgument.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

InvalidArgument.prototype.write = function(output) {
  output.writeStructBegin('InvalidArgument');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var AlreadySet = function(args) {
  this.message = null;
  if (args) {
    if (args.message !== undefined && args.message !== null) {
      this.message = args.message;
    }
  }
};
Thrift.inherits(AlreadySet, Thrift.TException);
AlreadySet.prototype.name = 'AlreadySet';
AlreadySet.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.message = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

AlreadySet.prototype.write = function(output) {
  output.writeStructBegin('AlreadySet');
  if (this.message !== null && this.message !== undefined) {
    output.writeFieldBegin('message', Thrift.Type.STRING, 1);
    output.writeString(this.message);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var NoSuchUUID = function(args) {
  this.UUID = null;
  if (args) {
    if (args.UUID !== undefined && args.UUID !== null) {
      this.UUID = args.UUID;
    }
  }
};
Thrift.inherits(NoSuchUUID, Thrift.TException);
NoSuchUUID.prototype.name = 'NoSuchUUID';
NoSuchUUID.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.UUID = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

NoSuchUUID.prototype.write = function(output) {
  output.writeStructBegin('NoSuchUUID');
  if (this.UUID !== null && this.UUID !== undefined) {
    output.writeFieldBegin('UUID', Thrift.Type.STRING, 1);
    output.writeString(this.UUID);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var AuthToken = function(args) {
  this.token = null;
  if (args) {
    if (args.token !== undefined && args.token !== null) {
      this.token = args.token;
    }
  }
};
AuthToken.prototype = {};
AuthToken.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.token = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

AuthToken.prototype.write = function(output) {
  output.writeStructBegin('AuthToken');
  if (this.token !== null && this.token !== undefined) {
    output.writeFieldBegin('token', Thrift.Type.STRING, 1);
    output.writeString(this.token);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var DownloadRequest = function(args) {
  this.requestId = null;
  this.file_size = null;
  this.file_hash = null;
  this.block_size = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
    if (args.file_size !== undefined && args.file_size !== null) {
      this.file_size = args.file_size;
    }
    if (args.file_hash !== undefined && args.file_hash !== null) {
      this.file_hash = args.file_hash;
    }
    if (args.block_size !== undefined && args.block_size !== null) {
      this.block_size = args.block_size;
    }
  }
};
DownloadRequest.prototype = {};
DownloadRequest.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.I64) {
        this.file_size = input.readI64().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.file_hash = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.I32) {
        this.block_size = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

DownloadRequest.prototype.write = function(output) {
  output.writeStructBegin('DownloadRequest');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  if (this.file_size !== null && this.file_size !== undefined) {
    output.writeFieldBegin('file_size', Thrift.Type.I64, 2);
    output.writeI64(this.file_size);
    output.writeFieldEnd();
  }
  if (this.file_hash !== null && this.file_hash !== undefined) {
    output.writeFieldBegin('file_hash', Thrift.Type.STRING, 3);
    output.writeString(this.file_hash);
    output.writeFieldEnd();
  }
  if (this.block_size !== null && this.block_size !== undefined) {
    output.writeFieldBegin('block_size', Thrift.Type.I32, 4);
    output.writeI32(this.block_size);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var UploadInfo = function(args) {
  this.packratId = null;
  this.filename = null;
  this.username = null;
  this.is_hex = null;
  this.is_compressed = null;
  this.file_hash = null;
  this.file_size = null;
  this.block_size = null;
  this.comment = null;
  if (args) {
    if (args.packratId !== undefined && args.packratId !== null) {
      this.packratId = args.packratId;
    }
    if (args.filename !== undefined && args.filename !== null) {
      this.filename = args.filename;
    }
    if (args.username !== undefined && args.username !== null) {
      this.username = args.username;
    }
    if (args.is_hex !== undefined && args.is_hex !== null) {
      this.is_hex = args.is_hex;
    }
    if (args.is_compressed !== undefined && args.is_compressed !== null) {
      this.is_compressed = args.is_compressed;
    }
    if (args.file_hash !== undefined && args.file_hash !== null) {
      this.file_hash = args.file_hash;
    }
    if (args.file_size !== undefined && args.file_size !== null) {
      this.file_size = args.file_size;
    }
    if (args.block_size !== undefined && args.block_size !== null) {
      this.block_size = args.block_size;
    }
    if (args.comment !== undefined && args.comment !== null) {
      this.comment = args.comment;
    }
  }
};
UploadInfo.prototype = {};
UploadInfo.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.I32) {
        this.packratId = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.filename = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.username = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.BOOL) {
        this.is_hex = input.readBool().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 5:
      if (ftype == Thrift.Type.BOOL) {
        this.is_compressed = input.readBool().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 6:
      if (ftype == Thrift.Type.STRING) {
        this.file_hash = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 7:
      if (ftype == Thrift.Type.I64) {
        this.file_size = input.readI64().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 8:
      if (ftype == Thrift.Type.I32) {
        this.block_size = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 9:
      if (ftype == Thrift.Type.STRING) {
        this.comment = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

UploadInfo.prototype.write = function(output) {
  output.writeStructBegin('UploadInfo');
  if (this.packratId !== null && this.packratId !== undefined) {
    output.writeFieldBegin('packratId', Thrift.Type.I32, 1);
    output.writeI32(this.packratId);
    output.writeFieldEnd();
  }
  if (this.filename !== null && this.filename !== undefined) {
    output.writeFieldBegin('filename', Thrift.Type.STRING, 2);
    output.writeString(this.filename);
    output.writeFieldEnd();
  }
  if (this.username !== null && this.username !== undefined) {
    output.writeFieldBegin('username', Thrift.Type.STRING, 3);
    output.writeString(this.username);
    output.writeFieldEnd();
  }
  if (this.is_hex !== null && this.is_hex !== undefined) {
    output.writeFieldBegin('is_hex', Thrift.Type.BOOL, 4);
    output.writeBool(this.is_hex);
    output.writeFieldEnd();
  }
  if (this.is_compressed !== null && this.is_compressed !== undefined) {
    output.writeFieldBegin('is_compressed', Thrift.Type.BOOL, 5);
    output.writeBool(this.is_compressed);
    output.writeFieldEnd();
  }
  if (this.file_hash !== null && this.file_hash !== undefined) {
    output.writeFieldBegin('file_hash', Thrift.Type.STRING, 6);
    output.writeString(this.file_hash);
    output.writeFieldEnd();
  }
  if (this.file_size !== null && this.file_size !== undefined) {
    output.writeFieldBegin('file_size', Thrift.Type.I64, 7);
    output.writeI64(this.file_size);
    output.writeFieldEnd();
  }
  if (this.block_size !== null && this.block_size !== undefined) {
    output.writeFieldBegin('block_size', Thrift.Type.I32, 8);
    output.writeI32(this.block_size);
    output.writeFieldEnd();
  }
  if (this.comment !== null && this.comment !== undefined) {
    output.writeFieldBegin('comment', Thrift.Type.STRING, 9);
    output.writeString(this.comment);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var UploadRequest = function(args) {
  this.requestId = null;
  this.filename = null;
  this.file_hash = null;
  this.block_size = null;
  if (args) {
    if (args.requestId !== undefined && args.requestId !== null) {
      this.requestId = args.requestId;
    }
    if (args.filename !== undefined && args.filename !== null) {
      this.filename = args.filename;
    }
    if (args.file_hash !== undefined && args.file_hash !== null) {
      this.file_hash = args.file_hash;
    }
    if (args.block_size !== undefined && args.block_size !== null) {
      this.block_size = args.block_size;
    }
  }
};
UploadRequest.prototype = {};
UploadRequest.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.requestId = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 2:
      if (ftype == Thrift.Type.STRING) {
        this.filename = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 3:
      if (ftype == Thrift.Type.STRING) {
        this.file_hash = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 4:
      if (ftype == Thrift.Type.I32) {
        this.block_size = input.readI32().value;
      } else {
        input.skip(ftype);
      }
      break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

UploadRequest.prototype.write = function(output) {
  output.writeStructBegin('UploadRequest');
  if (this.requestId !== null && this.requestId !== undefined) {
    output.writeFieldBegin('requestId', Thrift.Type.STRING, 1);
    output.writeString(this.requestId);
    output.writeFieldEnd();
  }
  if (this.filename !== null && this.filename !== undefined) {
    output.writeFieldBegin('filename', Thrift.Type.STRING, 2);
    output.writeString(this.filename);
    output.writeFieldEnd();
  }
  if (this.file_hash !== null && this.file_hash !== undefined) {
    output.writeFieldBegin('file_hash', Thrift.Type.STRING, 3);
    output.writeString(this.file_hash);
    output.writeFieldEnd();
  }
  if (this.block_size !== null && this.block_size !== undefined) {
    output.writeFieldBegin('block_size', Thrift.Type.I32, 4);
    output.writeI32(this.block_size);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var FileInfo = function(args) {
  this.filename = null;
  if (args) {
    if (args.filename !== undefined && args.filename !== null) {
      this.filename = args.filename;
    }
  }
};
FileInfo.prototype = {};
FileInfo.prototype.read = function(input) {
  input.readStructBegin();
  while (true) {
    var ret = input.readFieldBegin();
    var ftype = ret.ftype;
    var fid = ret.fid;
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    switch (fid) {
      case 1:
      if (ftype == Thrift.Type.STRING) {
        this.filename = input.readString().value;
      } else {
        input.skip(ftype);
      }
      break;
      case 0:
        input.skip(ftype);
        break;
      default:
        input.skip(ftype);
    }
    input.readFieldEnd();
  }
  input.readStructEnd();
  return;
};

FileInfo.prototype.write = function(output) {
  output.writeStructBegin('FileInfo');
  if (this.filename !== null && this.filename !== undefined) {
    output.writeFieldBegin('filename', Thrift.Type.STRING, 1);
    output.writeString(this.filename);
    output.writeFieldEnd();
  }
  output.writeFieldStop();
  output.writeStructEnd();
  return;
};

var PORT = 9091;
var JSON_PORT = 9092;
var DEFAULT_BLOCKSIZE = 10458576;
var INVALID_PACKRAT_ID = 16777215;
var API_VERSION = '2.0.17';



