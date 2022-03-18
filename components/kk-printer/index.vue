<template>
	<view class="kk-printer">
		<view class="kk-printer-btn" @tap="handlePrintTap">
			{{isPrinting?printingText:defaultText}}
		</view>
		<view class="kk-shadow" :class="isShowSearch?'show':''" @tap="handleSearchClose">
			<view class="kk-modal" @tap.stop="doNothing">
				<view class="kk-search-device">
					<view class="kk-filter-wrap">
						<view class="filter-title">根据SRRI过滤设备</view>
						<slider @change="handleSRRIChange" max='-20' min='-100' value="-95" show-value/>
					</view>
					<view class="kk-filter-wrap">
						<view class="filter-title">根据蓝牙名过滤</view>
						<input type="text" placeholder-class="kk-placeholder-class" placeholder="请输入蓝牙名字或设备ID搜索" v-model="filterName" />
					</view>
					<view class="kk-btn-wrap">
						<view class="kk-btn-item confirm-btn" @tap="searchBtnTap" v-if="!isSearching">
							搜索设备
						</view>
						<view class="kk-btn-item confirm-btn" v-else>
							搜索中...
						</view>
						<view class="kk-btn-item" @tap="stopSearchBtnTap">
							停止搜索
						</view>
					</view>
					<view class="kk-devices-wrap">
						<view class="empty-wrap" v-if="filterDeviceList.length <= 0">
							<view class="empty-icon"></view>
							<view class="empty-text">~ 无可搜索到的设备 ~</view>
						</view>
						<view class="" v-else>
							<view class="kk-devices-item" v-for="(item,index) in filterDeviceList" :key="index" @tap="handleConnectDevice(item)">
								<view class="name">
									<text>设备名称：</text>
									<text>{{item.name?item.name:'未命名'}}</text>
								</view>
								<view class="rssi">
									<text>信号强度：</text>
									<text>({{Math.max(0, item.RSSI + 100)}}%)</text>
								</view>
								<view class="deviceid">
									<text>设备ID：</text>
									<text>{{item.deviceId}}</text>
								</view>
								<view class="advmac" v-if="item.advMac">
									<text>advMac：</text>
									<text>{{item.advMac}}</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import gbk from '@/components/kk-printer/utils/printUtil-GBK.js';
	import * as blesdk from './utils/bluetoolth';
	import util from './utils/util.js';
	export default {
		data(){
			return{
				//是否正在打印
				isPrinting:false,
				//是否正在搜索设备
				isSearching:false,
				//是否显示蓝牙列表
				isShowSearch:false,
				//按蓝牙名过滤
				filterName:'',
				//按信号过滤
				filterRSSI:-95,
				//设备列表
				devicesList:[],
				//连接的设备ID
				deviceId:'',
				//根据设备ID获取的服务
				services:'',
				//获取特征值时返回的三要素
				serviceId: '',
				writeId: '', 
				readId: ''
			}
		},
		props:{
			//按钮默认文字
			defaultText:{
				type:String,
				default:'打印'
			},
			//按钮打印中的文字
			printingText:{
				type:String,
				default:'打印中...'
			},
			bufferData:{
				type:String,
				require:true
			}
		},
		computed:{
			mapFilterRSSI(){
				return (0 - this.filterRSSI)
			},
			filterDeviceList(){
				let devices = this.devicesList;
				let name = this.filterName;
				let rssi = this.filterRSSI;
				console.log(devices,name,rssi)
				//按RSSI过滤
				let filterDevices1 = devices.filter((item)=>{
					return item.RSSI > rssi
				})
				console.log(filterDevices1)
				// 按名字过滤
				let filterDevices2
				if(name!=''){
					filterDevices2 = filterDevices1.filter((item)=>{
						return (item.name.indexOf(name) >= 0 || item.deviceId.indexOf(name) >= 0)
					})
				}else{
					filterDevices2 = filterDevices1
				}
				// 根据广播数据提取MAC地址
				for (let i = 0; i < filterDevices2.length;i++) {  
					if (filterDevices2[i].hasOwnProperty('advertisData')){          
						if (filterDevices2[i].advertisData.byteLength == 8) {
							filterDevices2[i].advMac = util.buf2hex(filterDevices2[i].advertisData.slice(2, 7));
						}
					} 
				}
				return filterDevices2
			}
		},
		mounted() {
			
		},
		beforeDestroy(){
			this.stopSearchBtnTap();
		},
		methods:{
			doNothing(){
				return;
			},
			//点击打印按钮
			handlePrintTap(){
				//打开蓝牙适配器
				blesdk.openBlue().then((res)=>{
					//获取已连接设备
					blesdk.getConnectedBluetoothDevices().then((res)=>{
						//若没有已连接设备，弹框搜索设备
						console.log(res,this.deviceId,this.serviceId,this.writeId,this.bufferData,this.onPrintSuccess)
						if(res.devices.length == 0){
							this.isShowSearch = true
						}else{
							let datalen=20;
							if (plus.os.name != 'Android')
							{         
							  datalen=180;
							}
							this.isPrinting = true;
							this.$emit('onPrint');
							this.$nextTick(()=>{
								console.log(1,this.bufferData)
								if(this.bufferData!=''){
									let buffer = gbk.strToGBKByte(this.bufferData)
									console.log(2,buffer)
									let opt = {
										deviceId: this.deviceId, 
										serviceId: this.serviceId, 
										characteristicId: this.writeId,
										value:buffer,
										lasterSuccess: this.onPrintSuccess,
										onceLength:datalen
									}
									console.log(3,opt)
									blesdk.sendDataToDevice(opt);
									this.isPrinting = false;
								}
							})
						}
					}).catch((err)=>{
						blesdk.catchToast(err);
					})
				}).catch((err)=>{
					blesdk.catchToast(err);
				})
			},
			onGetDevice(res){
				this.devicesList = res;
			},
			handleSearchClose(){
				this.isShowSearch = false
			},
			handleSRRIChange(e){
				this.filterRSSI = e.detail.value
			},
			//开始搜索设备
			searchBtnTap(){
				blesdk.startBluetoothDevicesDiscovery();
				this.isSearching = true;
				blesdk.onfindBlueDevices(this.onGetDevice)
			},
			//停止搜索设备
			stopSearchBtnTap(){
				blesdk.stopBlueDevicesDiscovery();
				this.isSearching = false;
			},
			//点击连接设备
			handleConnectDevice(device){
				
				let deviceId = device.deviceId;
				let name = device.name;
				this.deviceId = deviceId;
				console.log('deviceId',this.deviceId)
				// uni.setStorageSync('k_curDeviceID',deviceId);
				// uni.setStorageSync('k_curDeviceName',name);
				uni.onBLEConnectionStateChange((res)=>{
					console.log('连接',res)
					if(res.connected){
						plus.nativeUI.toast('设备'+ res.deviceId + '已连接',{
							verticalAlign:'center'
						})
					}else{
						plus.nativeUI.toast('设备'+ res.deviceId + '已断开连接',{
							verticalAlign:'center'
						})
					}
			    })
				blesdk.createBLEConnection(deviceId, this.onConnectSuccess, this.onConnectFail);
			},
			onConnectSuccess(res){
				this.stopSearchBtnTap()
				blesdk.getBLEDeviceServices(this.deviceId, this.onGetServicesSuccess, this.onGetServicesFail);
			},
			onConnectFail(err){
				console.log('链接失败',err)
			},
			onGetServicesSuccess(res){
				console.log('获取服务',res)
				this.services = res.serviceId;
				blesdk.getDeviceCharacteristics(this.deviceId, this.services, this.onGetCharacterSuccess, this.onGetCharacterFail);
			},
			onGetServicesFail(err){
				console.log('获取服务失败')
			},
			onGetCharacterSuccess(res){
				console.log('获取特征值成功',res)
				this.serviceId = res.serviceId;
				this.writeId = res.writeId;
				this.readId = res.readId;
				this.isShowSearch = false;
			},
			onGetCharacterFail(err){
				console.log('特征值获取失败')
			},
			onPrintSuccess(){
				this.isPrinting = false;
				console.log('打印成功')
				this.$emit('onPrintSuccess')
			},
			onPrintFail(){
				console.log('打印失败')
				this.isPrinting = false;
			}
		}
	}
</script>

<style lang="scss" scoped>
	.kk-printer{
		&-btn{
			width:100%;
			height:100%;
		}
		.kk-shadow{
			display: none;
			&.show{
				display: block;
				width:100vw;
				height:100vh;
				background: rgba(0,0,0,0.4);
				position: fixed;
				top: 0;
				left: 0;
				display: flex;
				justify-content: center;
				align-items: center;
				.kk-modal{
					width:680upx;
					height: 80%;
					padding:24upx;
					box-sizing: border-box;
					overflow-y: auto;
					border-radius: 20upx;
					background: #ffffff;
					display: flex;
					justify-content: center;
					align-items: center;
					.kk-search-device{
						width:100%;
						height: 100%;
						.kk-filter-wrap{
							width:100%;
							height: 160upx;
							display: flex;
							flex-direction: column;
							justify-content: flex-start;
							align-items: flex-start;
							.filter-title{
								line-height: 70upx;
								font-size: 30upx;
								color: #999999;
							}
							&>slider{
								width:90%;
								height: 90upx;
							}
							&>input{
								padding:0 20upx;
								box-sizing: border-box;
								border-radius: 10upx;
								height: 90upx;
								width:100%;
								border: 1upx solid #ebebeb;
							}
						}
						.kk-btn-wrap{
							width:100%;
							height: 140upx;
							display: flex;
							justify-content: space-between;
							align-items: center;
							&>view{
								flex:1 1 auto;
								height: 100upx;
								line-height: 100upx;
								border-radius: 16upx;
								text-align: center;
								color:#ffffff;
								&.confirm-btn{
									background: #007AFF;
									margin-right:30upx;
								}
								&:nth-last-child(1){
									background: #DD524D;
								}
							}
						}
						.kk-devices-wrap{
							height: calc(100% - 460upx);
							overflow-y:auto;
							padding:10upx 20upx;
							box-sizing: border-box;
							border: 1upx solid #ebebeb;
							box-sizing: border-box;
							border-radius: 20upx;
							.empty-wrap{
								width:100%;
								height: 100%;
								display: flex;
								flex-direction: column;
								justify-content: center;
								align-items: center;
								.empty-icon{
									width:268upx;
									height: 240upx;
									background: url('./empty-icon.png') no-repeat;
									background-size:100% 100%;
									margin-bottom: 26upx;
								}
								.empty-text{
									width: 100%;
									line-height: 50upx;
									font-size: 30upx;
									text-align: center;
									color: #999999;
								}
							}
							.kk-devices-item{
								width:100%;
								border-bottom: 1upx solid #ebebeb;
								padding:10upx 0;
								box-sizing: border-box;
								&:nth-last-child(1){
									border-bottom: none;
								}
								&>view{
									width:100%;
									font-size: 30upx;
								}
							}
						}
					}
				}
			}
			
		}
	}
	.kk-placeholder-class{
		font-size: 30upx;
		color:#999999;
	}
</style>
