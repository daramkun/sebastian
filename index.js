'use strict';

const Discord = require('discord.js');
const client = new Discord.Client();
const fetch = require('node-fetch');

const config = require('./config/config.secret.js');
const city_to_coord = require('./data/city_to_coord.js');

// 넘치는 텍스트를 자른다
function get_wrapped_text(text, length = 8)
{
	if(text != null && text.length > length)
		text = text.substring(0, length) + '...';
	return text;
}

// 해당 URL에서 웹페이지 데이터를 가져온다
async function get_webpage_to_json(url)
{
	const response = await fetch(url);
	const ret = await response.json();
	return ret;
}

// 프로젝트 이름을 통해서 ID를 가져온다
async function get_project_id(project_name)
{
	var searched = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${config.gitlab.organization}%2F${project_name}?private_token=${config.gitlab.access_token}`);
	if(searched == null || (typeof searched.message !== 'undefined' && (searched.message.indexOf('404') == 0)))
		return -1;
	return searched.id;
}

// 모든 이슈 목록을 가져온다
async function get_project_opened_issues(project_id)
{
	if(project_id == -1) return null;
	
	var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}`);
	if(list == null || (typeof list.message !== 'undefined' && (list.message.indexOf('404') == 0)))
		return null;

	return list;
}

// 열린 이슈 목록을 가져온다
async function get_project_opened_issues(project_id)
{
	if(project_id == -1) return null;
	
	var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}&state=opened`);
	if(list == null || (typeof list.message !== 'undefined' && (list.message.indexOf('404') == 0)))
		return null;

	return list;
}

// 닫힌 이슈 목록을 가져온다
async function get_project_closed_issues(project_id)
{
	if(project_id == -1) return null;
	
	var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}&state=closed`);
	if(list == null || (typeof list.message !== 'undefined' && (list.message.indexOf('404') == 0)))
		return null;

	return list;
}

// 열린 이슈 중 마감 이슈 목록을 가져온다
async function get_project_due_issues(project_id)
{
	if(project_id == -1) return null;

	let today = new Date();
	let compareDate = (today - new Date(0, 0, config.due_from_days)).valueOf();
	
	var list = await get_project_opened_issues(project_id);
	if(list == null)
		return null;
	
	var dues = list.filter((value) => {
		let dueday = new Date(value.due_date).valueOf();
		return (compareDate >= dueday);
	});

	return dues;
}

// 이슈 내용을 가져온다
async function get_issue(project_id, issue_id)
{
	if(project_id == -1 || issue_id <= 0)
		return null;

	var issue = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues/${issue_id}?private_token=${config.gitlab.access_token}`);
	if(issue == null || (typeof issue.message !== 'undefined' && (issue.message.indexOf('404') == 0)))
		return null;

	return issue;
}

// 머지 리퀘스트 내용을 가져온다
async function get_merge_request(project_id, mr_id)
{
	if(project_id == -1 || mr_id <= 0)
		return null;

	var mr = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/merge_requests/${mr_id}?private_token=${config.gitlab.access_token}`);
	if(mr == null || (typeof mr.message !== 'undefined' && (mr.message.indexOf('404') == 0)))
		return null;

	return mr;
}

// 위키 목록을 가져온다
async function get_wiki_list(project_id)
{
	if(project_id == -1)
		return null;

	var wikis = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/wikis?private_token=${config.gitlab.access_token}&with_content=1`);
	if(wikis == null || (typeof wikis.message !== 'undefined' && (wikis.message.indexOf('404') == 0)))
		return null;

	return wikis;
}

// 날씨 데이터를 가져온다
async function get_openweathermap_data(city)
{
	var city_coord = city_to_coord[city];
	if(city_to_coord[city] === 'undefined')
		city_coord = city_to_coord['서울'];
	return await get_webpage_to_json(`https://api.openweathermap.org/data/2.5/weather?lat=${city_coord[0]}&lon=${city_coord[1]}&appid=${config.openweathermap_api_key}`);
}

function weather_to_korean(weather)
{
	console.log(weather);
	const cloudy = typeof weather.clouds !== 'undefined' && weather.clouds.all >= 50;
	const rainy = typeof weather.rain !== 'undefined' && weather.rain._1h >= 5;
	const snow = typeof weather.snow !== 'undefined' && weather.snow._1h >= 5;

	if(rainy && snow) return '눈비';
	else if(snow) return '눈';
	else if(rainy) return '비';
	else if(cloudy) return '구름';
	else return '맑음';
}

// 켈빈을 섭씨로 바꾼다
function k_to_c(temp)
{
	return (temp - 273.15).toPrecision(3);
}

async function process_issue(channel, token)
{
	if(token.length < 3)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var issue_id = parseInt(token[2]);
	var project_id = await get_project_id(project_name);
	if(project_id != -1)
	{
		var issue = await get_issue(project_id, issue_id);
		if(issue != null)
		{
			var embed = new Discord.MessageEmbed()
				.setTitle('이슈 여기 있습니다. 💁‍♂️');
			embed.addFields(
				{ name: '제목', value: issue.title },
				{ name: '작성자', value: issue.author.name, inline: true },
				{ name: '상태', value: issue.state, inline: true }
			);
			if (issue.due_date != null && issue.due_date != '')
			{
				embed.addField('마감기한', issue.due_date, true);

				if(issue.state == 'opened')
				{
					let today = new Date().getDate();
					let dueday = new Date(issue.due_date).getDate();

					if(today < dueday)
						embed.setColor('22B14C');
					else if (today > dueday)
						embed.setColor('FF0000');
					else
						embed.setColor('FFF200');
				}
			}
			if (issue.description != null && issue.description != '')
				embed.addField('본문', issue.description);
			embed.addField('경로', `[링크](${config.gitlab.project_root}${project_name}/-/issues/${issue_id})`);
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 이슈를 찾지 못했습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_merge_request(channel, token)
{
	if(token.length < 3)
	{
		channel.send('죄송하지만, 정보를 더 주십시오.');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var mr_id = parseInt(token[2]);
	var project_id = await get_project_id(project_name);
	
	if(project_id != -1)
	{
		var mr = await get_merge_request(project_id, mr_id);
		if(mr != null)
		{
			var embed = new Discord.MessageEmbed()
				.setTitle('머지 리퀘스트 여기 있습니다. 💁‍♂️');
			embed.addFields(
				{ name: '제목', value: mr.title },
				{ name: '작성자', value: mr.author.name, inline: true },
				{ name: '상태', value: mr.state, inline: true }
			);
			if (mr.description != null && mr.description != '')
				embed.addField('본문', mr.description);
			embed.addField('경로', `[링크](${config.gitlab.project_root}${project_name}/-/merge-request/${mr_id})`);
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 머지 리퀘스트를 찾지 못했습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_opened_issues_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_project_opened_issues(project_id);
		if(list != null)
		{
			var embed = new Discord.MessageEmbed()
				.setTitle('열려 있는 이슈 목록 여기 있습니다. 💁‍♂️');
			for(var i = 0; i < list.length; ++i)
			{
				if(i % 8 == 0)
				{
					channel.send(embed);
					embed = new Discord.MessageEmbed();
					embed.setColor('00cc00');
				}

				var value = list[i];
				embed.addFields(
					{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
					{ name: '제목', value: value.title, inline: true },
					{ name: '마감일', value: (value.due_date != null && value.due_date != '') ? value.due_date : '없음', inline: true }
				);
			}
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 뭔가 잘못됐습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_closed_issues_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_project_closed_issues(project_id);
		if(list != null)
		{
			var embed = new Discord.MessageEmbed()
				.setTitle('닫혀 있는 이슈 목록 여기 있습니다. 💁‍♂️');
			for(var i = 0; i < list.length; ++i)
			{
				if(i % 8 == 0)
				{
					channel.send(embed);
					embed = new Discord.MessageEmbed();
					embed.setColor('cc0000');
				}

				var value = list[i];
				embed.addFields(
					{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
					{ name: '제목', value: value.title, inline: true },
					{ name: '마감일', value: (value.due_date != null && value.due_date != '') ? value.due_date : '없음', inline: true }
				);
			}
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 뭔가 잘못됐습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_due_issues_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_project_due_issues(project_id);
		if(list != null)
		{
			var embed = new Discord.MessageEmbed();
			if(list == null)
			{
				embed.setTitle('프로젝트를 찾지 못했습니다. 🤷‍♂️');
				embed.setDescription('프로젝트 이름을 다시 확인해주십시오.');
			}
			else if(list.length == 0)
			{
				embed.setTitle('열려 있는 이슈 중 마감 기한이 다 된 이슈가 없습니다. 🙅‍♂️');
				embed.setDescription('프로젝트가 순조롭군요. 좋습니다.');
			}
			else
			{
				embed.setTitle('마감 기한이 다가오는 이슈 목록 여기 있습니다. 💁‍♂️');
				embed.setColor('cc0000');
				for(var i = 0; i < list.length; ++i)
				{
					if(i % 8 == 0)
					{
						channel.send(embed);
						embed = new Discord.MessageEmbed();
						embed.setColor('cc0000');
					}

					var value = list[i];
					embed.addFields(
						{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
						{ name: '제목', value: value.title, inline: true },
						{ name: '마감일', value: (value.due_date != null && value.due_date != '') ? value.due_date : '없음', inline: true }
					);
				}
			}
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 뭔가 잘못됐습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_wikis_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_wiki_list(project_id);
		if(list != null)
		{
			var embed = new Discord.MessageEmbed()
				.setTitle('위키 페이지 목록 여기 있습니다. 💁‍♂️');
			for(var i = 0; i < list.length; ++i)
			{
				if(i % 8 == 0)
				{
					channel.send(embed);
					embed = new Discord.MessageEmbed();
				}

				var value = list[i];
				embed.addFields(
					{ name: '#', value: `[🌍](${config.gitlab.project_root}${project_name}/-/wikis/${value.slug})`, inline: true },
					{ name: '제목', value: value.title, inline: true },
					{ name: '내용', value: get_wrapped_text(value.content), inline: true }
				);
			}
			channel.send(embed);
		}
		else
		{
			channel.send('죄송하지만, 뭔가 잘못됐습니다. 🤷‍♂️');
		}
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다. 🤷‍♂️');
	}
}

async function process_weather(channel, token)
{
	var city = token.length > 1 ? token[1] : '서울';
	var weather = await get_openweathermap_data(city);

	var embed = new Discord.MessageEmbed()
		.setTitle('해당 지역의 오늘의 날씨입니다. 💁‍♂️')
		.addFields(
			{ name: '날씨', value: `${weather_to_korean(weather)}`, inline: true },
			{ name: '온도', value: `${k_to_c(weather.main.temp)}`, inline: true },
			{ name: '현재 최저/최대온도', value: `${k_to_c(weather.main.temp_min)} / ${k_to_c(weather.main.temp_max)}`, inline: true },
			{ name: '습도', value: `${weather.main.humidity}`, inline: true },
			{ name: '바람 세기', value: `${weather.wind.speed}m/s`, inline: true }
		);
	channel.send(embed);
}

function currency_char(rate)
{
	switch(rate)
	{
		case 'USD':
		case 'AUD':
		case 'CAD':
		case 'ARS':
			return '＄';
		case 'CAD':
			return 'C＄';
		case 'KRW':
			return '￦';
		case 'EUR':
			return '€';
		case 'GBP':
			return '￡';
		case 'JPY':
		case 'CNY':
			return '￥';
	}
}

function string_to_currency_float(x)
{
	return parseFloat(x.replace(',', ''));
}

function number_with_commas(x)
{
	return Math.ceil(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function process_currency_exchange(channel, token)
{
	if(token.length < 4)
	{
		channel.send('죄송하지만, 정보를 더 주십시오. 🤦‍♂️');
		channel.send('$사용법');
		return;
	}

	var currency_exchange = await get_webpage_to_json(`https://api.exchangeratesapi.io/latest?base=${token[1]}`);
	var base_currency = currency_exchange.rates[token[2]];
	var my_currency = string_to_currency_float(token[3]);

	channel.send(`**${token[1]}** __${currency_char(token[1])}${number_with_commas(my_currency)}__을 **${token[2]}**로 변환하면 __${currency_char(token[2])}${number_with_commas(my_currency * base_currency)}__ 입니다. 💁‍♂️`);
}

function process_usage(channel)
{
	var embed = new Discord.MessageEmbed()
		.setTitle('세바스찬 사용법')
		.setColor(0xff0000)
		.setDescription('제 사용법은 이렇습니다. 🙇‍♂️')
		.addFields(
			{ name: '!ping', value: '세바스찬의 생사 유무를 알 수 있습니다.' },
			{ name: '$명령 이슈 <프로젝트이름> <이슈번호>', value: '해당 프로젝트의 이슈 페이지를 가져옵니다.' },
			{ name: '$명령 MR <프로젝트이름> <MR번호>', value: '해당 프로젝트의 머지 리퀘스트 페이지를 가져옵니다.' },
			{ name: '$명령 열린이슈 <프로젝트이름>', value: '해당 프로젝트에 열려 있는 이슈 목록을 가져옵니다.' },
			{ name: '$명령 닫힌이슈 <프로젝트이름>', value: '해당 프로젝트에 닫혀 있는 이슈 목록을 가져옵니다.' },
			{ name: '$명령 마감이슈 <프로젝트이름>', value: '해당 프로젝트에 열려 있는 이슈 중 마감 기한이 다 된 목록을 가져옵니다.' },
			{ name: '$명령 위키목록 <프로젝트이름>', value: '해당 프로젝트에 작성된 위키 목록을 가져옵니다.' },
			{ name: '$명령 날씨 <도시>', value: '현재 날씨를 가져옵니다. 도시가 생략되면 서울 기준.' },
			{ name: '$명령 환율 <원본화폐> <바뀔화폐> <가격>', value: '해당 화폐의 환율 정보를 가져옵니다.' },
			{ name: '$등록', value: '세바스찬이 직접 메시지를 전달하는 채널을 등록합니다. 이전에 등록한 채널 정보는 사라집니다.' },
			{ name: '$공지 <보낼 메시지>', value: '서버에 공지 형식으로 메시지를 전달합니다.' },
			{ name: '$식사골라줘', value: '임의의 식사 메뉴를 골라줍니다.' },
			{ name: '던!', value: '해당 메시지에 DONE 반응이 추가됩니다.' },
			{ name: '다이스! 또는 주사위!', value: '해당 메시지에 1~6 사이의 임의의 숫자가 반응으로 추가됩니다.' },
			{ name: '가위바위보! <가위/바위/보>', value: '해당 메시지에 가위, 돌, 종이 중 하나가 반응으로 추가됩니다. 가위바위보! 대신 묵찌빠!도 됩니다.' },
			{ name: '이슈 경로 또는 머지 리퀘스트 경로', value: '해당 이슈 또는 머지 리퀘스트의 내용을 가져옵니다.' },
		);
	channel.send(embed);
}

function do_period_action()
{
	const now = new Date();
	client.setTimeout(() => {
		client.setInterval(() => {
			config.check_due_in_period.forEach(
				async (project_name) => {
					var issues = await get_project_due_issues(project_name);
					if(issues.length > 0) {
						var embed = new Discord.MessageEmbed()
							.setTitle(`${project_name} 프로젝트의 오늘 마감 또는 마감기한이 다 한 이슈입니다.`)
							.setDescription('부디 마감일을 지켜주십시오.')
							.setColor(0xdd0000);
						issues.forEach(value => {
							embed.addFields(
								{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
								{ name: '제목', value: value.title, inline: true },
								{ name: '마감일', value: value.due_date, inline: true }
							);
						});
						global.messagingChannel.get(config.soliloquy_channel_id).send(embed);
					}
				}
			)
		}, 24 * 60 * 60 * 1000);
	}, (-now + now.setHours(18, 0, 0, 0)));
}

process.on('SIGINT', () => {
	console.log('\r세바스찬은 쉬러 갑니다.');
	process.exit();
});
process.on('uncaughtException', err => {
	console.log('세바스찬이 과로로 쓰러졌습니다:\n\r' + err);
});

client.on('ready', async () => {
	console.log(`세바스찬, ${client.user.tag} 명의로 대기 중.`);
	client.user.setStatus('available');
	client.user.setActivity('사용법은 "$사용법"을 채팅창에 입력하세요.');

	console.log(`마감 기한 확인 일수: ${config.due_from_days}일 전까지`);

	const talk_guild = client.guilds.cache.find(function (key) {
		return (key == config.talk_channel.guild);
	});
	const talk_channel = talk_guild.channels.cache.find(function (key) {
		return (key == config.talk_channel.channel);
	});

	global.messagingChannel = talk_channel;
});

client.on('message', async message =>
{
	const url_pattern = new RegExp(`${config.gitlab.project_root}([a-zA-Z가-힣0-9_\\-]+)/-/((issues)|(merge_requests))/([0-9]+)`);
	const issue_command_pattern = new RegExp(/([a-zA-Z가-힣0-9_\\-]+) #([0-9]+)/);
	const mr_command_pattern = new RegExp(/([a-zA-Z가-힣0-9_\\-]+) !([0-9]+)/);
		
	if(message.content == '!ping')
	{
		message.reply('!pong');
		if(typeof global.messagingChannel === 'undefined' || global.messagingChannel == null)
		{
			message.reply('채널 등록이 되어 있지 않으니 **$등록** 명령어를 이용해 채널 등록을 권장 드립니다.');
		}
	}
	else if(message.content.indexOf('$명령 ') == 0)
	{
		const order = message.content.substring(4);
		if (order.indexOf('이슈 ') == 0)
			await process_issue(message.channel, order.split(' '));
		else if (order.indexOf('MR ') == 0)
			await process_merge_request(message.channel, order.split(' '));
		else if(order.indexOf('열린이슈 ') == 0)
			await process_opened_issues_list(message.channel, order.split(' '));
		else if(order.indexOf('닫힌이슈 ') == 0)
			await process_closed_issues_list(message.channel, order.split(' '));
		else if(order.indexOf('마감이슈 ') == 0)
			await process_due_issues_list(message.channel, order.split(' '));
		else if(order.indexOf('위키목록 ') == 0)
			await process_wikis_list(message.channel, order.split(' '));
		else if(issue_command_pattern.test(order))
		{
			const match = order.match(issue_command_pattern);
			await process_issue(message.channel, [null, match[1], match[2]]);
		}
		else if(mr_command_pattern.test(order))
		{
			const match = order.match(mr_command_pattern);
			await process_merge_request(message.channel, [null, match[1], match[2]]);
		}
		else if(order.indexOf('날씨') == 0 && config.openweathermap_api_key.length != 0)
		{
			await process_weather(message.channel, order.split(' '));
		}
		else if(order.indexOf('환율') == 0)
		{
			await process_currency_exchange(message.channel, order.split(' '));
		}
		else
		{
			message.channel.send('잘못된 명령 사용법입니다. 🤦‍♂️');
			message.channel.send('$사용법');
		}
	}
	else if(message.content.trim() == '$등록')
	{
		global.messagingChannel = message.channel;
		message.reply('채널이 등록되었습니다.');

		do_period_action();
	}
	else if(message.content.trim() == '던!')
	{
		const emoji = message.guild.emojis.cache.find(emoji => emoji.name === 'done');
		if(emoji != null)
			message.react(emoji);
	}
	else if(message.content.trim() == '던?')
	{
		const emoji = message.guild.emojis.cache.find(emoji => emoji.name === 'done');
		if(emoji != null)
			message.react(emoji).then(() => message.react('❓'));
	}
	else if(message.content.trim() == '다이스!' || message.content.trim() == '주사위!')
	{
		const roll = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
		var selected = Math.round(Math.random() * 5)
		message.react(roll[selected]);
	}
	else if(message.content.indexOf('가위바위보!') == 0 || message.content.indexOf('묵찌빠!') == 0)
	{
		const order = message.content.split(' ');
		if(order.length != 2)
			message.react('❓');
		else
		{
			const rsp = ['🧱', '✂', '📜'];
			var selected = Math.round(Math.random() * 2)
			message.react(rsp[selected]);

			switch(order[1])
			{
			case '가위':
			case '찌':
				switch (rsp[selected])
				{
				case '✂': message.react('😕'); break;
				case '🧱': message.react('🤣'); break;
				case '📜': message.react('😥'); break;
				}
				break;

			case '바위':
			case '주먹':
			case '묵':
				switch (rsp[selected])
				{
				case '🧱': message.react('😕'); break;
				case '📜': message.react('🤣'); break;
				case '✂': message.react('😥'); break;
				}
				break;

			case '보':
			case '빠':
				switch (rsp[selected])
				{
				case '📜': message.react('😕'); break;
				case '✂': message.react('🤣'); break;
				case '🧱': message.react('😥'); break;
				}
				break;
				
			default: message.react('🤔'); break;
			}
		}
	}
	else if(message.content.trim() == '$식사골라줘')
	{
		var meals = ['치킨🐔', '피자🍕', '파스타🍝', '햄버거🍔', '냉면🍜', '칼국수🍜', '김밥🍙', '떡볶이🍲',
			'돈까스🍱', '보쌈🥬', '족발🍗', '돼지고기🐷', '소고기🐮', '스테이크🥩', '샤브샤브🍲', '뷔페🍱',
			'초밥🍣', '회🐟', '라멘🍜', '짜장면/짬뽕🍜', '마라탕🍲', '스키야끼🍲', '게장🦀', '타코🌮',
			'국밥🍲', '카레/커리🍛', '쌀국수🍜'];
		message.channel.send(`이 음식이 좋겠군요: 💁‍♂️ ${meals[Math.round(Math.random() * (meals.length - 1))]}`);
	}
	else if(message.content.indexOf('$공지 ') == 0)
	{
		if(typeof global.messagingChannel === 'undefined' || global.messagingChannel == null)
		{
			message.channel.send('공지가 나갈 채널을 등록해주세요. 🤦‍♂️');
		}
		else
		{
			var embed = new Discord.MessageEmbed().setTitle(`주인님 중 한 분이 다음과 같은 공지를 남겼습니다. 💁‍♂️`);
			global.messagingChannel.send(embed);
			global.messagingChannel.send(message.content.substr(4, message.content.length - 4));

			console.log(`[${new Date()}] ${message.author.tag}: ${message.content}`);
		}
	}
	else if(message.content.indexOf(config.gitlab.project_root) >= 0)
	{
		var match = message.content.match(url_pattern);

		if(match != null && match != 'undefined')
		{
			if(match[2] == 'issues')
				await process_issue(message.channel, [null, match[1], match[5]]);
			else if(match[3] == 'merge_requests')
				await process_merge_request(message.channel, [null, match[1], match[5]]);
		}
	}
	else if(message.content.indexOf('$사용법') == 0)
	{
		process_usage(message.channel);
	}
});

console.log('세바스찬이 깨어납니다.');
client.login(config.discord_token);
