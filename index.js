const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const moment = require('moment');
const fs = require('fs');

moment.locale('pt-br');

axiosCookieJarSupport(axios);
 
const cookieJar = new tough.CookieJar();

const readline = require('readline')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const auth = (authData) => {

  return new Promise((resolve, reject)=>{

    let data = {
      'client_id': 'play-valorant-web-prod',
            'nonce': '1',
            'redirect_uri': 'https://playvalorant.com/opt_in',
            'response_type': 'token id_token',
    };

    axios.post('https://auth.riotgames.com/api/v1/authorization', data, {jar: cookieJar, withCredentials: true})
      .then(response=> {
        
        //create an .env file at the root of the project and add these variables
        data = {
            type: 'auth',
            username: authData.username,
            password: authData.password
        };
        
        axios.put('https://auth.riotgames.com/api/v1/authorization', data, {jar: cookieJar, withCredentials: true})
        .then(response=>{
          
          let uri = response.data.response.parameters.uri;
          let strTokens = uri.replace('https://playvalorant.com/opt_in#', '').split('&');

          let arrayTokens = {};

          strTokens.forEach(token=>{
            arrayTokens[token.split('=')[0]] = token.split('=')[1];
          });

          //console.log('Access Token:', arrayTokens.access_token)
          
          axios.defaults.headers.common['X-Riot-ClientPlatform'] = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
          axios.defaults.headers.common['Authorization'] = `Bearer ${arrayTokens.access_token}`

          axios.post('https://entitlements.auth.riotgames.com/api/token/v1', {}, {jar: cookieJar, withCredentials: true})
          .then(response=>{

            let entitlements_token = response.data.entitlements_token;
            axios.defaults.headers.common['X-Riot-Entitlements-JWT'] = entitlements_token;

           //console.log('\nEntitlements Token:', entitlements_token);

            axios.post('https://auth.riotgames.com/userinfo', {}, {jar: cookieJar, withCredentials: true})
            .then(response=>{

              let user_id = response.data.sub;
              console.log('Player Id:', user_id);
              resolve(user_id);

            });

          });

        });

      })
      .catch(error=> {
        reject(error);
      });

    });
}

const getMovementString = (before, after) => {

  if(after > before){
    return 'Promoção';
  }
  else if(after < before){
    return 'Rebaixamento';
  }
  else{
    return 'Elo inalterado';
  }

}

const getRankString = rankId => {

  let rankName, rankNumber;

  if(rankId < 6)
    rankName = 'Ferro';
  else if(rankId < 9)
    rankName = 'Bronze';
  else if(rankId < 12)
    rankName = 'Prata';
  else if(rankId < 15)
    rankName = 'Ouro';
  else if(rankId < 18)
    rankName = 'Platina';
  else if(rankId < 21)
    rankName = 'Diamante';
  else if(rankId < 24)
    rankName = 'Imortal';
  else
    return 'Radiante';

  if(((rankId / 3) % 1).toFixed(2) == 0.00){
    rankNumber = 1;
  }
  else if(((rankId / 3) % 1).toFixed(2) == 0.33){
    rankNumber = 2;
  }
  else{
    rankNumber = 3;
  }

  return `${rankName} ${rankNumber}`

}

const getRankedInfo = async (playerId, startIndex = 0, endIndex = '') => {

  let res = await axios.get(`https://pd.NA.a.pvp.net/mmr/v1/players/${playerId}/competitiveupdates?startIndex=${startIndex}&endIndex=${endIndex}`);

  let matches = res.data.Matches.reverse();
  matches = matches.filter(match=>match.TierBeforeUpdate != 0); //filtra as partidas rankeadas apenas;

  let numMatches = matches.length;

  if(numMatches > 0){

    matches.forEach(match=>{

      console.log('\nPartida encontrada:', moment(match.MatchStartTime).format('DD/MM/YYYY HH:mm'));
      console.log('Pontos antes:', match.RankedRatingBeforeUpdate, '|| Pontos depois:', match.RankedRatingAfterUpdate);
      console.log('Rank antes:', getRankString(match.TierBeforeUpdate), '|| Rank depois:', getRankString(match.TierAfterUpdate));
      console.log('Movimento:', getMovementString(match.TierBeforeUpdate, match.TierAfterUpdate));

    });

    console.log(`\nFaltam ${100 - matches[numMatches - 1 ].RankedRatingAfterUpdate} pontos para o ${getRankString(matches[numMatches -1].TierAfterUpdate + 1)}`);

  }
  else{
    console.log('\nNenhuma partida competitiva encontrada nas últimas 10 :/');
  }

}

const getAuthData = async () => {

  return new Promise(async (resolve, reject)=>{

    try{

      if(!fs.existsSync('config.json')){

        let authData = {};
        console.log('Estas informações serão repassadas diretamente aos servidores da Riot, não sendo de forma alguma armazenadas remotamente.');
        
        await rl.question('Usuário: ', answer=>{
            authData.username = answer;
            rl.question('Senha: ', answer=>{

              authData.password = answer;
              fs.writeFileSync('config.json', JSON.stringify(authData));
              resolve(authData);

            });
        });


      }
      else{
        
        let raw = fs.readFileSync('config.json');
        const authData = JSON.parse(raw);
        resolve(authData);

      }

    }
    catch(e){
      reject(e);
    }

  });

};

const main = async () => {
  
  let authData = await getAuthData();
  let playerId = await auth(authData);
  await getRankedInfo(playerId);

}

main();



