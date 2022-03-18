/**
 * @export
 * @param {string} name 微信api的名称 ，如 uniAsyncPromise("getSystemInfo",options)
 * @param {object} options 除了success 和 fail 的其他参数
 * @returns
 */
export function uniAsyncPromise(name, options) {
	return new Promise((resolve, reject) => {
		uni[name]({
			...(options || {}),
			// ...options,
			success: (res) => {
				resolve(res);
			},
			fail: (err) => {
				reject(err);
			}
		});
	});
}
//微信小程序向蓝牙打印机发送数据进行打印的坑：
//小程序api向蓝牙打印机发送数据打印，发送的任何内容都应该要转成二进制数据，而且蓝牙打印的文本编码是GBK的，发送中文需转成GBK编码再转成二进制数据发送
//发送打印机指令也要转成二进制数据发送
//蓝牙打印机一次接收的二级制数据有限制，不同的系统不同的蓝牙设备限制可能不同，微信建议一次20个字节，需做递归分包发送
//发送完要打印的内容后，一定要发送一个打印的指令才能顺利打印 （有些指令就不需要）

//一、初始化蓝牙、开始检索蓝牙设备
// { allowDuplicatesKey: true, interval: 500}
export function openBlue() {
	return uniAsyncPromise('openBluetoothAdapter')
}

export function startBluetoothDevicesDiscovery(option) {
	console.log('开始蓝牙扫描');
	uniAsyncPromise('startBluetoothDevicesDiscovery', option).then((res) => {
		console.log('正在搜寻蓝牙设备', res);
	});
}

export function getConnectedBluetoothDevices(option) {
	console.log('开始获取已连接设备');
	return uniAsyncPromise('getConnectedBluetoothDevices', option)
}
//二、
/**
 *
 *
 * @export
 * @param {function} getDevices uni.getBluetoothDevices的监听回调函数
 */
export function onfindBlueDevices(getDevices) {
	//监听寻找到新设备的事件
	uni.onBluetoothDeviceFound((devices)=>{
		//获取在蓝牙模块生效期间所有已发现的蓝牙设备
		uniAsyncPromise('getBluetoothDevices').then((res) => {
			getDevices && getDevices(res.devices);
		});
	});
}

/**
 * @export
 * @param {function} stopBlueDevicesDiscovery 关闭蓝牙扫描
 */
export function stopBlueDevicesDiscovery() {
	//监听寻找到新设备的事件
	console.log('停止蓝牙扫描');
	return uniAsyncPromise('stopBluetoothDevicesDiscovery').then((res) => {
		console.log('停止搜寻蓝牙设备', res);
	});
}



//三、连接蓝牙设备
/**
 * @export
 * @param {function} createBLEConnection 
 * @param {number} deviceId 蓝牙设备id
 */
export function createBLEConnection(deviceId, sucess, fail) {
	//连接蓝牙设备
	console.log('连接蓝牙设备', deviceId);
	uniAsyncPromise("createBLEConnection", {
			deviceId
		})
		.then(res => {
			//连接成功可选择停止搜索蓝牙
			//stopBlueDevicesDiscovery();
			console.log('连接成功');
			sucess && sucess({
				res: res,
			});
		})
		.catch(res => {
			console.log('连接设备异常' + res);
			fail && fail({
				res: res,
			});
		})
	/*.finally(res=>{
	    console.log('连接成功');
	    sucess && sucess({
	        res: res,
	    });
	});*/
}

export function closeBLEConnection(deviceId) {
	console.log('断开蓝牙设备', deviceId);
	uniAsyncPromise("closeBLEConnection", {
			deviceId
		})
		.then(res => {
			console.log('BLEDisconnect complete', res);
		})
		.catch(res => {
			console.log('断开设备异常' + res);
		})
	/*.finally(res=>{
	    console.log('BLEDisconnect complete', res);            
	});  */
}

//四、连接成功后， 获取蓝牙设备的service服务
// uniAsyncPromise("getBLEDeviceServices",{deviceId:""}).then(res=>{})
export function getBLEDeviceServices(deviceId, success, fail) {
	console.log('获取ServiceId', deviceId);
	//加延迟避免取不到service
	setTimeout(()=>{
		uniAsyncPromise("getBLEDeviceServices", {
			deviceId:deviceId
		})
		.then(res => {
			console.log('服务', res);
			success && success({
				serviceId: res.services,
			});
		})
		.catch((res) => {
			//getBLEDeviceServices(deviceId, success, fail);
			console.log('获取ServiceId异常' + res);
			fail && fail({
				res: res,
			});
		});
	},1000)
}

//五、获取的service服务可能有多个，递归获取特征值（最后要用的是能读，能写，能监听的那个值的uuid作为特征值id）
/**
 *
 *
 * @export
 * @param {number} deviceId 蓝牙设备id
 * @param {array} services uniAsyncPromise("getBLEDeviceServices",{deviceId:""}).then(res=>{})获取的res.services
 * @param {function} success 成功取得有用特征值uuid的回调函数
 */
export function getDeviceCharacteristics(deviceId, services, success, fail) {
	//services = services.slice(0);
	console.log('获取Characteristics', deviceId, services);
	if (services.length) {
		const serviceId = services.shift().uuid;
		console.log('ServceID ', serviceId);
		uniAsyncPromise('getBLEDeviceCharacteristics', {
				deviceId,
				serviceId,
			})
			.then((res) => {
				console.log('getBLEDeviceCharacteristics', deviceId, serviceId, res);
				let finished = false;
				let write = false;
				let notify = false;
				let indicate = false;
				var readId;
				var writeId;
				//有斑马品牌的一款打印机中res.characteristics的所有uuid都是相同的，找所有的properties存在(notify || indicate) && write这种情况就说明这个uuid是可用的（不确保所有的打印机都能用这种方式取得uuid,在主要测试得凯盛诺打印机res.characteristic只有一个uuid,所以也能用这个方式）
				for (var i = 0; i < res.characteristics.length; i++) {
					if (!notify) {
						notify = res.characteristics[i].properties.notify;
						if (notify) readId = res.characteristics[i].uuid;
					}
					if (!indicate) {
						indicate = res.characteristics[i].properties.indicate;
						if (indicate) readId = res.characteristics[i].uuid;
					}
					if (!write) {
						write = res.characteristics[i].properties.write;
						writeId = res.characteristics[i].uuid;
					}
					if ((notify || indicate) && write) {
						/* 获取蓝牙特征值uuid */
						success &&
							success({
								serviceId,
								writeId: writeId,
								readId: readId,
							});
						finished = true;
						break;
					}
				}

				if (!finished) {
					getDeviceCharacteristics(deviceId, services, success, fail);
				}
			})
			.catch((res) => {
				getDeviceCharacteristics(deviceId, services, success, fail);
			});
	} else {
		fail && fail();
	}
}

//六、启动notify 蓝牙监听功能 然后使用 uni.onBLECharacteristicValueChange用来监听蓝牙设备传递数据
/**
 * @export
 * @param {object} options
 * {
            deviceId,//蓝牙设备id
            serviceId,//服务id
            characteristicId,//可用特征值uuid
    }
 * @param {function} onChange 监听蓝牙设备传递数据回调函数
 */
export function onGetBLECharacteristicValueChange(options, onChange = function() {}) {
	console.log('deviceId ', options.deviceId);
	console.log('serviceId ', options.serviceId);
	console.log('characteristicId ', options.characteristicId);
	uniAsyncPromise('notifyBLECharacteristicValueChange', {
		state: true,
		...options,
	}).then((res) => {
		console.log('onBLECharacteristicValueChange ');
		uni.onBLECharacteristicValueChange(onChange);
	});
}

//七、发送数据(递归分包发送)
/**
 * @export
 * @param {object} options
 * {
            deviceId,
            serviceId,
            characteristicId,
			value [ArrayBuffer],
			lasterSuccess,
            onceLength
    }
 */

export function sendDataToDevice(options) {
	let byteLength = options.value.byteLength;
	//这里默认一次20个字节发送
	const speed = options.onceLength; //20; 
	console.log("send data 20");
	console.log(options);
	if (byteLength > 0) {
		uniAsyncPromise('writeBLECharacteristicValue', {
				...options,
				value: options.value.slice(0, byteLength > speed ? speed : byteLength),
			})
			.then((res) => {
				if (byteLength > speed) {
					sendDataToDevice({
						...options,
						value: options.value.slice(speed, byteLength),
					});
				} else {
					options.lasterSuccess && options.lasterSuccess();
				}
			})
			.catch((res) => {
				console.log(res);
			});
	}
}
export function charToArrayBuffer(str) {
	var out = new ArrayBuffer(str.length);
	var uint8 = new Uint8Array(out);
	var strs = str.split('');
	for (var i = 0; i < strs.length; i++) {
		uint8[i] = strs[i].charCodeAt();
	}
	return uint8;
}
export function charToArray(str) {
	var arr = [];
	var strs = str.split('');
	for (var i = 0; i < strs.length; i++) {
		arr[i] = strs[i].charCodeAt();
	}
	return arr;
}
//打印二维码
/**
 * @export
 * @param {object} options
 * {
            deviceId,
            serviceId,
            characteristicId,
            value,//ArrayBuffer:二维码的数据
    }
 */
export function printQR(options) {
	//打印二维码的十进制指令data：
	let data = [29, 107, 97, 7, 4, options.value.byteLength, 0];
	sendDataToDevice({
		...options,
		value: new Uint8Array(data).buffer,
		lasterSuccess: () => {
			//指令发送成功后，发送二维码的数据
			sendDataToDevice(options);
		},
	});
}

function grayPixle(pix) {
	return pix[0] * 0.299 + pix[1] * 0.587 + pix[2] * 0.114;
}

export function overwriteImageData(data) {
	let sendWidth = data.width,
		sendHeight = data.height;
	const threshold = data.threshold || 180;
	let sendImageData = new ArrayBuffer((sendWidth * sendHeight) / 8);
	sendImageData = new Uint8Array(sendImageData);
	let pix = data.imageData;
	const part = [];
	let index = 0;
	for (let i = 0; i < pix.length; i += 32) {
		//横向每8个像素点组成一个字节（8位二进制数）。
		for (let k = 0; k < 8; k++) {
			const grayPixle1 = grayPixle(pix.slice(i + k * 4, i + k * 4 + (4 - 1)));
			//阈值调整
			if (grayPixle1 > threshold) {
				//灰度值大于threshold位   白色 为第k位0不打印
				part[k] = 0;
			} else {
				part[k] = 1;
			}
		}
		let temp = 0;
		for (let a = 0; a < part.length; a++) {
			temp += part[a] * Math.pow(2, part.length - 1 - a);
		}
		//开始不明白以下算法什么意思，了解了字节才知道，一个字节是8位的二进制数，part这个数组存的0和1就是二进制的0和1，传输到打印的位图数据的一个字节是0-255之间的十进制数，以下是用权相加法转十进制数，理解了这个就用上面的for循环替代了
		// const temp =
		//     part[0] * 128 +
		//     part[1] * 64 +
		//     part[2] * 32 +
		//     part[3] * 16 +
		//     part[4] * 8 +
		//     part[5] * 4 +
		//     part[6] * 2 +
		//     part[7] * 1;
		sendImageData[index++] = temp;
	}
	return {
		array: Array.from(sendImageData),
		width: sendWidth / 8,
		height: sendHeight,
	};
}
/**
 * printImage
 * @param {object} opt
 * {
            deviceId,//蓝牙设备id
            serviceId,//服务id
            characteristicId,//可用特征值uuid
            lasterSuccess , //最后完成的回调
    }
 */
export function printImage(opt = {}, imageInfo = {}) {
	let arr = imageInfo.array,
		width = imageInfo.width;
	const writeArray = [];
	const xl = width % 256;
	const xh = width / 256;
	//分行发送图片数据,用的十进制指令
	const command = [29, 118, 48, 0, xl, xh, 1, 0]; //1D 76 30 00 w h 
	const enter = [13, 10];
	for (let i = 0; i < arr.length / width; i++) {
		const subArr = arr.slice(i * width, i * width + width);
		const tempArr = command.concat(subArr);
		writeArray.push(new Uint8Array(tempArr));
	}
	writeArray.push(new Uint8Array(enter));
	//console.log(writeArray);
	const print = (options, writeArray) => {
		if (writeArray.length) {
			console.log("send");
			sendDataToDevice({
				...options,
				value: writeArray.shift().buffer,
				lasterSuccess: () => {
					if (writeArray.length) {
						print(options, writeArray);
					} else {
						options.lasterSuccess && options.lasterSuccess();
					}
				},
			});
		}
	};
	console.log("start print");
	print(opt, writeArray);
}

/* 16hex insert 0 */
function Hex2Str(num) {
	if (num.toString(16).length < 2) return "0" + num.toString(16);
	else
		return num.toString(16);
}
/*****CPCL指令接口****/

/**
 * 配置项如下
 *
 * width: 标签纸的宽度，单位像素點
 * height: 标签纸的高度，单位像素點
 * 8像素=1mm
 * printNum: 打印张数，默认为1
 * rotation：页面整体旋转 1-90度 2-180度 3-270度 其他-不旋转
 */
export function CreatCPCLPage(width, height, printNum, rotation = 0, offset = 0) {
	var strCmd = '! ' + offset + ' 200 200 ' + height + ' ' + printNum + '\n';
	strCmd += "PAGE-WIDTH " + width + '\n';
	if (rotation == 1)
		strCmd += "ZPROTATE90\n";
	else if (rotation == 2)
		strCmd += "ZPROTATE180\n";
	else if (rotation == 3)
		strCmd += "ZPROTATE270\n";
	else
		strCmd += "ZPROTATE0\n";
	return strCmd;
}

/**
 * 打印文字
 * x: 文字方块左上角X座标，单位dot
 * y: 文字方块左上角Y座标，单位dot
 * fontName,fontSize: 字体，取值： 參考文檔
 * rotation: 旋转 1-90度 2-180度 3-270度 其他-不旋转 
 * content: 文字内容
 */
export function addCPCLText(x, y, fontName, fontSize, rotation, content) {
	//console.log(fontName,fontSize,rotation, content);   
	var strCmd = '';
	if (rotation == 1) {
		strCmd += 'T90 ';
	}
	if (rotation == 2) {
		strCmd += 'T180 ';
	}
	if (rotation == 3) {
		strCmd += 'T270 ';
	} else {
		strCmd += 'T ';
	}
	strCmd += fontName + ' ' + fontSize + ' ' + x + ' ' + y + ' ' + content + '\n';
	return strCmd;
};

/**
 * 打印一维码
 *
 * x: 文字方块左上角X座标，单位dot
 * y: 文字方块左上角Y座标，单位dot
 * codeType: 条码类型，取值为128、UPCA、UPCA2、UPCA5、UPCE、UPCE2、UPC5、EAN13、EAN13+2、EAN13+5、
 *      EAN8、EAN8+2、EAN8+5、39、39C、F39、F39C、93、CODABAR、CODABAR16、ITF、I2OF5
 * h: 条码高度，单位dot 
 * rotation: 顺时针旋转角度，取值如下：
 *     - 0 不旋转
 *     - 1 顺时针旋转90度
 *     
 * narrow: 窄条码比例因子(dot) 取值： 參考文檔
 * wide: 宽条码比例因子(dot) 取值： 參考文檔
 * content: 文字内容
 *
 */
export function addCPCLBarCode(x, y, codeType, h, rotation, narrow, wide, content) {
	var strCmd = '';
	if (rotation == 0)
		strCmd += 'B ';
	else
		strCmd += 'VB ';
	strCmd += codeType + ' ' + narrow + ' ' + wide + ' ' + h + ' ' + x + ' ' + y + ' ' + content + '\n'
	return strCmd;
};

/**
 * 打印二维码
 *
 * x: 文字方块左上角X座标，单位dot
 * y: 文字方块左上角Y座标，单位dot
 * level: 错误纠正能力等级，取值为L(7%)、M(15%)、Q(25%)、H(30%)
 * ver: 1-10 版本，根据内容调整以获取合适容量
 * scale: 1-10 放大倍数
 * content: 文字内容
 *
 */
export function addCPCLQRCode(x, y, level, ver, scale, content) {
	var strCmd = 'B QR ' + x + ' ' + y + ' M ' + ver + ' U ' + scale + '\n' + level + 'A,' + content + '\n';
	strCmd += 'ENDQR\n';
	return strCmd;
};

/**
 * 放大指令
 * scaleX: 横向放大倍数 1，2，3等整数
 * scaleY: 纵向放大倍数 1，2，3等整数
 */
export function addCPCLSETMAG(scaleX, scaleY) {
	var strCmd = 'SETMAG ' + scaleX + ' ' + scaleY + '\n';
	return strCmd;
};

/**
 * 对齐指令 0-左对齐 1-右对齐 2-居中
 */
export function addCPCLLocation(set) {
	var strCmd = '';
	if (set == 1) {
		strCmd += 'RIGHT\n';
	} else if (set == 2) {
		strCmd += 'CENTER\n';
	} else {
		strCmd += 'LEFT\n';
	}
	return strCmd;
};

/**
 * 反白线 x0,y0,x1,y1,width
 */
export function addCPCLInverseLine(x0, y0, x1, y1, width) {
	var strCmd = 'IL ' + x0 + ' ' + y0 + ' ' + x1 + ' ' + y1 + ' ' + width + '\n';
	return strCmd;
};

/**
 * 画线 x0,y0,x1,y1,width
 */
export function addCPCLLine(x0, y0, x1, y1, width) {
	var strCmd = 'L ' + x0 + ' ' + y0 + ' ' + x1 + ' ' + y1 + ' ' + width + '\n';
	return strCmd;
};

/**
 * 画框 x0,y0,x1,y1,width
 */
export function addCPCLBox(x0, y0, x1, y1, width) {
	var strCmd = 'BOX ' + x0 + ' ' + y0 + ' ' + x1 + ' ' + y1 + ' ' + width + '\n';
	return strCmd;
};

/**
 * 字体加粗
 */
export function addCPCLSETBOLD(bold) {
	var strCmd = 'SETBOLD ' + bold + '\n';
	return strCmd;
};

/**
 * 字体下划线
 */
export function addCPCLUNDERLINE(c) {
	var strCmd = 'UNDERLINE ';
	if (c) strCmd += 'ON\n';
	else if (c) strCmd += 'OFF\n';
	return strCmd;
};

/**
 * 水印打印灰度等级 0-255
 */
export function addCPCLBACKGROUND(level) {
	var strCmd = 'BACKGROUND ';
	if (level > 255 || level < 0) level = 255;
	strCmd += level + '\n';
	return strCmd;
};

/**
 * 打印水印文字
 * x: 文字方块左上角X座标，单位dot
 * y: 文字方块左上角Y座标，单位dot
 * fontName,fontSize: 字体，取值： 參考文檔
 * rotation: 旋转 1-90度 2-180度 3-270度 其他-不旋转 
 * content: 文字内容
 */
export function addCPCLBKVText(x, y, fontName, fontSize, rotation, content) {
	//console.log(fontName,fontSize,rotation, content);   
	var strCmd = '';
	if (rotation == 1) {
		strCmd += 'BKT90 ';
	}
	if (rotation == 2) {
		strCmd += 'BKT180 ';
	}
	if (rotation == 3) {
		strCmd += 'BKT270 ';
	} else {
		strCmd += 'BKT ';
	}
	strCmd += fontName + ' ' + fontSize + ' ' + x + ' ' + y + ' ' + content + '\n';
	return strCmd;
};


/**
 * 标签缝隙定位指令
 */
export function addCPCLGAP() {
	var strCmd = 'GAP-SENSE\nFORM\n';
	return strCmd;
};

/**
 * 标签右黑标检测指令
 */
export function addCPCLSENSE() {
	var strCmd = 'BAR-SENSE\nFORM\n';
	return strCmd;
};

/**
 * 标签左黑标检测指令
 */
export function addCPCLSENSELEFT() {
	var strCmd = 'BAR-SENSE LEFT\nFORM\n';
	return strCmd;
};

/**
 * 打印指令
 */
export function addCPCLPrint() {
	var strCmd = 'PRINT\n';
	return strCmd;
};

/**
 * 图片打印指令
 * x: 文字方块左上角X座标，单位dot
 * y: 文字方块左上角Y座标，单位dot
 * data{
            threshold,//0/1提取的灰度级
            width,//图像宽度
            height,//图像高度
            imageData , //图像数据
    }
 */
export function addCPCLImageCmd(x, y, data) {
	var strImgCmd = '';
	const threshold = data.threshold || 180;
	let myBitmapWidth = data.width,
		myBitmapHeight = data.height;
	let len = parseInt((myBitmapWidth + 7) / 8); //一行的数据长度
	//console.log('len=',len);
	//console.log('myBitmapWidth=',myBitmapWidth);
	//console.log('myBitmapHeight=',myBitmapHeight);
	let ndata = 0;
	let i = 0;
	let j = 0;
	let sendImageData = new ArrayBuffer(len * myBitmapHeight);
	sendImageData = new Uint8Array(sendImageData);
	let pix = data.imageData;
	console.log('pix=', pix);

	for (i = 0; i < myBitmapHeight; i++) {
		for (j = 0; j < len; j++) {
			sendImageData[ndata + j] = 0;
		}
		for (j = 0; j < myBitmapWidth; j++) {
			const grayPixle1 = grayPixle(pix.slice((i * myBitmapWidth + j) * 4, (i * myBitmapWidth + j) * 4 + 3));
			if (grayPixle1 < threshold)
				sendImageData[ndata + parseInt(j / 8)] |= (0x80 >> (j % 8));

		}
		ndata += len;
	}
	//console.log('sendImageData=',sendImageData);
	//CPCL指令图片数据 
	strImgCmd += 'EG ' + len + ' ' + myBitmapHeight + ' ' + x + ' ' + y + ' ';
	for (i = 0; i < sendImageData.length; i++) {
		strImgCmd += Hex2Str(sendImageData[i]);
	}
	strImgCmd += '\n';
	//console.log(strImgCmd);
	return strImgCmd;
}
/**
 * toast显示捕获的蓝牙异常
 */
export function catchToast(err) {
	const errMsg = {
		10000: '未初始化蓝牙模块',
		10001: '蓝牙未打开',
		10002: '没有找到指定设备',
		10003: '连接失败',
		10004: '没有找到指定服务',
		10005: '没有找到指定特征值',
		10006: '当前连接已断开',
		10007: '当前特征值不支持此操作',
		10008: '系统上报异常',
		10009: '系统版本低于 4.3 不支持BLE'
	};
	let coode = err.errCode ? err.errCode.toString() : '';
	let msg = errMsg[coode];
	plus.nativeUI.toast(msg || coode, {
		align: 'center',
		verticalAlign: 'center'
	});
}
