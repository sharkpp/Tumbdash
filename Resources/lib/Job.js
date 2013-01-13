//	var lib = require('lib');
//	var w = lib.Job.createTask({});

var this_ = null;

module.exports = (function(global){
	// 既にインスタンスが生成済みの場合は保持している値を返す
	// 基本、require()はキャッシュするのでここは通らない
	if (this_) {
		return this_;
	}

	var lib = require('lib');

	var Job = function(){
		var self = this;
		// なんかやらないとエラーになる、、、別のコンテキストからだと読めないとかかな？
		this.Slot_ = require('lib/Job/Slot');
	};

	/////////////////////////////////////////

	/////////////////////////////////////////
	// プロパティ
	/////////////////////////////////////////

	// Task プロパティ [RO]
	Job.prototype.__defineGetter__("Task", function() {
		if (this.Task_)
			return this.Task_;
		return this.Task_ = require('lib/Job/Task');
	});

	// Slot プロパティ [RO]
	Job.prototype.__defineGetter__("Slot", function() {
		if (this.Slot_)
			return this.Slot_;
		return this.Slot_ = require('lib/Job/Slot');
	});

	/////////////////////////////////////////
	// メソッド
	/////////////////////////////////////////

	// createTask(params)
	Job.prototype.createTask = function(params){
		return new this.Task(params);
	};

	// createSlot(params)
	Job.prototype.createSlot = function(params){
		return new this.Slot(params);
	};

	// foreach(items, fn)
	Job.prototype.foreach = function(items, fn) {
		var self = this;
		var task = new this.Task({
				title: 'Job.foreach',
				withExec: false,
			});
		for (i in items) {
			task.add(function(params){ return {
					state: 1,
					exec: function(){
							var r = fn.call(this, params);
							task.exit(undefined == r ? true : r);
						},
					timeout: 0,
				}}, items[i]);
		}
		return task;
	}

	// インスタンスを生成して返す	
	return this_ = new Job;
})(this);
