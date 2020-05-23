'use strict';

const Discord = require('discord.js');
const client = new Discord.Client();
const fetch = require('node-fetch');

const config = require('./config/config.secret.js');

async function get_webpage_to_json(url)
{
	const response = await fetch(url);
	const ret = await response.json();
	return ret;
}

async function get_project_id(project_name)
{
	var searched = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${config.gitlab.organization}%2F${project_name}?private_token=${config.gitlab.access_token}`);
	if(searched == null || searched == 'undefined')
		return -1;
	return searched.id;
}

async function process_issue(channel, token)
{
	if(token.length < 3)
	{
		channel.send('죄송하지만, 정보를 더 주십시오.');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var issue_id = parseInt(token[2]);
	var project_id = await get_project_id(project_name);
	if(project_id != -1) {
		var issue = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues/${issue_id}?private_token=${config.gitlab.access_token}`);
		var embed = new Discord.MessageEmbed()
			.setTitle('이슈 여기 있습니다. 💁‍♂️');
		embed.addFields(
			{ name: '제목', value: issue.title },
			{ name: '작성자', value: issue.author.name, inline: true },
			{ name: '상태', value: issue.state, inline: true }
		);
		if (issue.description != null && issue.description != '')
			embed.addField('본문', issue.description);
		embed.addField('경로', `[링크](${config.gitlab.project_root}${project_name}/-/issues/${issue_id})`);
		channel.send(embed);
	} else {
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다.');
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
	
	if(project_id != -1) {
		var mr = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/merge_requests/${mr_id}?private_token=${config.gitlab.access_token}`);

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
	} else {
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다.');
	}
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
			{ name: '이슈 경로 또는 머지 리퀘스트 경로', value: '해당 이슈 또는 머지 리퀘스트의 내용을 가져옵니다.' }
		);
	channel.send(embed);
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
	client.user.setActivity('사용법은 $사용법 을 채팅창에 입력하세요.');
});

client.on('message', async message =>
{
	if(message.content == "!ping")
	{
		message.reply("!pong");
		console.log(`${message.author.tag}의 요청으로 핑퐁함.`);
	}
	else if(message.content.indexOf('$명령 ') == 0)
	{
		var order = message.content.substring(4);
		if (order.indexOf('이슈 ') == 0)
		{
			var token = order.split(' ');
			await process_issue(message.channel, order.split(' '));
		}
		else if (order.indexOf('MR ') == 0)
		{
			await process_merge_request(message.channel, order.split(' '));
		}
		else
		{
			message.channel.send('잘못된 명령 사용법입니다.');
		}
	}
	else if(message.content.indexOf(config.gitlab.project_root) >= 0)
	{
		const re = new RegExp(`${config.gitlab.project_root}([a-zA-Z가-힣0-9_\\-]+)/-/((issues)|(merge_requests))/([0-9]+)`);
		var match = message.content.match(re);

		if(match != null && match != 'undefined')
		{
			if(match[2] == 'issues')
				process_issue(message.channel, [null, match[1], match[5]]);
			else if(match[3] == 'merge_requests')
				process_merge_request(message.channel, [null, match[1], match[5]]);
		}
	}
	else if(message.content.indexOf('$사용법') == 0)
	{
		process_usage(message.channel);
	}
});

client.login(config.discord_token);
