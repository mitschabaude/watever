export { numberOfRepos };

async function numberOfRepos(username) {
  // let res = await fetch(`https://api.github.com/users/${username}/repos`);
  // let json = await res.json();
  // return json.length + "";
  await new Promise((r) => setTimeout(r, 100 * Math.random()));
  return "19";
}
