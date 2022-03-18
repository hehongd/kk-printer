<template>
	<view class="content">
		<view class="btn-wrap">
			<kk-printer ref="kkprinter" :bufferData="bufferData" @onPrint="onPrint"></kk-printer>
		</view>
	</view>
</template>

<script>
	import util from '@/components/kk-printer/utils/util.js';
	import * as blesdk from '@/components/kk-printer/utils/bluetoolth.js';
	import kkPrinter from '@/components/kk-printer/index.vue';
	export default {
		data() {
			return {
				bufferData:''
			}
		},
		components:{
			kkPrinter
		},
		mounted() {
			
		},
		methods: {
			onPrint(opt){
				let strCmd =blesdk.CreatCPCLPage(560,500,1,0);  
				strCmd += blesdk.addCPCLLine(0,210,560,210,3);
				strCmd += blesdk.addCPCLText(10,0,'4','3',0,'8.14');
				strCmd += blesdk.addCPCLBarCode(270,0,'128',80,0,1,1,'00051');
				strCmd += blesdk.addCPCLText(290,80,'7','2',0,'00051');
				strCmd += blesdk.addCPCLText(40,110,'3','0',0,'CHICKEN FEET (BONELESS)-Copy-Copy');
				strCmd += blesdk.addCPCLSETMAG(2,2);
				strCmd += blesdk.addCPCLText(40,150,'55','0',0,'无骨鸡爪 一盒（约1.5磅）');
				strCmd += blesdk.addCPCLSETMAG(0,0);
				strCmd += blesdk.addCPCLText(350,180,'7','2',0,'2019-08-12');
				  
				strCmd += blesdk.addCPCLLocation(2);
				strCmd += blesdk.addCPCLQRCode(0,220,'M', 2, 6, 'qr code test');
				strCmd += blesdk.addCPCLPrint();
				this.bufferData = strCmd;
			}
		}
	}
</script>

<style>
	.content {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.btn-wrap{
		width:180upx;
		height: 100upx;
		border-radius: 16upx;
		border: 2upx solid #333333;
		box-sizing: border-box;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
