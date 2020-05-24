'use strict';

const Discord = require('discord.js');
const client = new Discord.Client();
const fetch = require('node-fetch');
const { Worker } = require('worker_threads');

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

async function get_project_due_issues(project_name)
{
	var project_id = get_project_id(project_name);

	var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}&state=opened`);
	var dues = list.filter((value) => {
		let today = new Date().getDate();
		let dueday = new Date(value.due_date).getDate();
		return (today >= dueday);
	});

	return dues;
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
	if(project_id != -1)
	{
		var issue = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues/${issue_id}?private_token=${config.gitlab.access_token}`);
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
	
	if(project_id != -1)
	{
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
	}
	else
	{
		channel.send('죄송하지만, 프로젝트를 찾지 못했습니다.');
	}
}

async function process_issues_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오.');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}&state=opened`);

		var embed = new Discord.MessageEmbed()
			.setTitle('열려 있는 이슈 목록 여기 있습니다. 💁‍♂️');
		list.forEach(value => {
			embed.addFields(
				{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
				{ name: '제목', value: value.title, inline: true },
				{ name: '마감일', value: (value.due_date != null && value.due_date != '') ? value.due_date : '없음', inline: true }
			);
		});
		channel.send(embed);
	}
}

async function process_due_issues_list(channel, token)
{
	if(token.length < 2)
	{
		channel.send('죄송하지만, 정보를 더 주십시오.');
		channel.send('$사용법');
		return;
	}

	var project_name = token[1];
	var project_id = await get_project_id(project_name);

	if(project_id != -1)
	{
		var list = await get_webpage_to_json(`${config.gitlab.gitlab_api_address}/projects/${project_id}/issues?private_token=${config.gitlab.access_token}&state=opened`);

		var embed = new Discord.MessageEmbed()
			.setTitle('열려 있는 이슈 중 마감 기한이 다 된 목록 여기 있습니다. 💁‍♂️');
		list.forEach(value => {
			let today = new Date().getDate();
			let dueday = new Date(value.due_date).getDate();

			if(today >= dueday)
			{
				embed.addFields(
					{ name: '#', value: `[${value.iid}](${config.gitlab.project_root}${project_name}/-/issues/${value.iid})`, inline: true },
					{ name: '제목', value: value.title, inline: true },
					{ name: '마감일', value: (value.due_date != null && value.due_date != '') ? value.due_date : '없음', inline: true }
				);
			}
		});
		channel.send(embed);
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
			{ name: '이슈 경로 또는 머지 리퀘스트 경로', value: '해당 이슈 또는 머지 리퀘스트의 내용을 가져옵니다.' },
			{ name: '$명령 활성이슈 <프로젝트이름>', value: '해당 프로젝트에 열려 있는 이슈 목록을 가져옵니다.' },
			{ name: '$명령 마감이슈 <프로젝트이름>', value: '해당 프로젝트에 열려 있는 이슈 중 마감 기한이 다 된 목록을 가져옵니다.' }
		);
	channel.send(embed);
}

function do_period_action()
{
	const now = new Date();
	client.setTimeout(() => {
		client.setInterval(() => {
			config.check_due_in_period.forEach(
				(project_name) => {
					var issues = get_project_due_issues(project_name);
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
						client.channels.resolve(config.soliloquy_channel_id).send(embed);
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
	client.user.setActivity('사용법은 ```$사용법```을 채팅창에 입력하세요.');
});

client.on('message', async message =>
{
	const url_pattern = new RegExp(`${config.gitlab.project_root}([a-zA-Z가-힣0-9_\\-]+)/-/((issues)|(merge_requests))/([0-9]+)`);
	const issue_command_pattern = new RegExp(/([a-zA-Z가-힣0-9_\\-]+) #([0-9]+)/);
	const mr_command_pattern = new RegExp(/([a-zA-Z가-힣0-9_\\-]+) !([0-9]+)/);
		
	if(message.content == "!ping")
		message.reply("!pong");
	else if(message.content.indexOf('$명령 ') == 0)
	{
		const order = message.content.substring(4);
		if (order.indexOf('이슈 ') == 0)
			await process_issue(message.channel, order.split(' '));
		else if (order.indexOf('MR ') == 0)
			await process_merge_request(message.channel, order.split(' '));
		else if(order.indexOf('활성이슈 ') == 0)
			await process_issues_list(message.channel, order.split(' '));
		else if(order.indexOf('마감이슈 ') == 0)
			await process_due_issues_list(message.channel, order.split(' '));
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
		else
		{
			message.channel.send('잘못된 명령 사용법입니다.');
			message.channel.send('$사용법');
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

do_period_action();

client.login(config.discord_token);
