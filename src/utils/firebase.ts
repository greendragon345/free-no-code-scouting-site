import { initializeApp } from "firebase/app";
import { ScouterDataType } from "../components/types/TableDataTypes"
import { collection, doc, getDoc, getDocs, getFirestore, updateDoc, deleteDoc, setDoc, DocumentData, DocumentReference, QueryDocumentSnapshot, addDoc } from 'firebase/firestore/lite';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { userToFirebase, User } from "../components/types/User";
import { UserTags } from "../components/UsersManager";
import { DataParamsModes, ParamItem } from "./params/ParamItem";

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

export const firebase = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebase);
const auth = getAuth(firebase);
signInAnonymously(auth).then((userCredential) => {
    console.log("Signed in anonymously");
}).catch((error) => {
    console.log(error);
});

export async function updateData(docPath: string, data: any) {
    await setDoc(doc(firestore, docPath), data);
}

export function getDocumentRef(docPath: string): DocumentReference {
    return doc(firestore, docPath)
}

export async function deleteDocument(docPath: string) {
    await deleteDoc(doc(firestore, docPath))
}

export async function getFieldValue(collectionName: any, fieldid: string): Promise<{ fieldid: string, fieldlvalue: string }[]> {
    const seasons = await getDocs(collection(firestore, collectionName));
    return seasons.docs.map((doc) => { return { fieldid: doc.id, fieldlvalue: doc.get(fieldid) } });
}

export async function getScouters(collectionName: any): Promise<{ key: string, firstname: string, lastname: string }[]> {
    const seasons = await getDocs(collection(firestore, collectionName));
    return seasons.docs.map((doc) => {
        return { key: doc.id + "", firstname: doc.get("firstname"), lastname: doc.get("lastname") }
    });
}

function getScouterDataTypeFromDocRef(docRef: string[]): ScouterDataType {
    let data = { key: (docRef[0] || 'undefined'), firstname: (docRef[1] || 'undefined'), lastname: (docRef[2] || 'undefined') }
    return data
}
function getScouterDataTypeArrayFromDocumentSnapshot(doc: QueryDocumentSnapshot<DocumentData>): ScouterDataType[] {
    let scouters: ScouterDataType[] = []
    for (let index = 0; index < 6; index++) {
        scouters.push(getScouterDataTypeFromDocRef(doc.get("" + index)))
    }
    return scouters
}

export async function getquals(qualPath: any): Promise<{ qual: string, scouters: { key: string, firstname: string, lastname: string }[] }[]> {
    const seasons = await getDocs(collection(firestore, qualPath));
    return seasons.docs.map((doc) => {

        return {
            qual: doc.id + "", scouters: getScouterDataTypeArrayFromDocumentSnapshot(doc)
        }
    });
}


export async function getSeasons(): Promise<{ year: string, name: string }[]> {
    const seasons = await getDocs(collection(firestore, 'seasons'));
    return seasons.docs.map((doc) => { return { year: doc.id, name: doc.get('name') } });
}

export async function getAllParams(seasonYear: string) {
    console.log(`Loading data for ${seasonYear}`)
    return [
        await getParams(DataParamsModes.AUTONOMOUS, seasonYear),
        await getParams(DataParamsModes.TELEOP, seasonYear),
        await getParams(DataParamsModes.ENDGAME, seasonYear),
        await getParams(DataParamsModes.SUMMARY, seasonYear)
    ];
}

export async function getParams(mode: DataParamsModes, seasonYear: string) {
    const dataParams = await getDoc(doc(firestore, 'seasons', seasonYear, 'data-params', mode));
    const data = dataParams.data() as ParamItem[];
    let params = []
    for (const param in data) {
        params.push({ ...data[param], name: param });
    }
    params = params.filter((param) => param != null);
    return params;

}

export async function setParamInFirebase(param: ParamItem, mode: DataParamsModes, seasonYear: string) {
    await updateDoc(doc(firestore, 'seasons', seasonYear, 'data-params', mode), { [param.name]: param });
}

export async function getUsers(seasonYear: string) {
    const users = await getDocs(collection(firestore, 'seasons', seasonYear, 'users'));
    return users.docs.map((doc) => { return { ...doc.data(), username: doc.id } as User });
}

export async function getUsernames(seasonYear: string) {
    const users = getUsers(seasonYear);
    return (await users).map((user) => user.username);
}

export async function deleteUser(seasonYear: string, username: string) {
    await deleteDoc(doc(firestore, 'seasons', seasonYear, 'users', username));
}

export async function updateUserInFirebase(seasonYear: string, user: User) {
    await updateDoc(doc(firestore, 'seasons', seasonYear, 'users', user.username), userToFirebase(user));
}

export async function addUserToFirebase(seasonYear: string, user: User) {
    await setDoc(doc(firestore, 'seasons', seasonYear, 'users', user.username), userToFirebase(user));
    const scoutingTeams = await getScoutingTeams(seasonYear);
    console.log(scoutingTeams);
    if (!scoutingTeams.includes(user.teamNumber.toString())) {
        await addUserToScoutingTeams(seasonYear, user.teamNumber.toString(), user.teamName);
    }
}

async function getScoutingTeams(seasonYear: string) {
    const teams = await getDocs(collection(firestore, 'seasons', seasonYear, 'scouting-teams'));
    return teams.docs.map((doc) => { return doc.id });
}

async function addUserToScoutingTeams(seasonYear: string, teamNumber: string, teamName: string) {
    await setDoc(doc(firestore, 'seasons', seasonYear, 'scouting-teams', teamNumber), { name: teamName });
}

export async function createSeason(seasonYear: string, seasonName: string) {
    await setDoc(doc(firestore, 'seasons', seasonYear), { name: seasonName });
    await createSeasonEmptyDataParams(seasonYear);
    await createDefaultAdminUser(seasonYear);
    await createDefaultScoutingTeams(seasonYear);
}

async function createSeasonEmptyDataParams(seasonYear: string) {
    await setDoc(doc(firestore, 'seasons', seasonYear, 'data-params', DataParamsModes.AUTONOMOUS), {});
    await setDoc(doc(firestore, 'seasons', seasonYear, 'data-params', DataParamsModes.TELEOP), {});
    await setDoc(doc(firestore, 'seasons', seasonYear, 'data-params', DataParamsModes.ENDGAME), {});
    await setDoc(doc(firestore, 'seasons', seasonYear, 'data-params', DataParamsModes.SUMMARY), {});
}

async function createDefaultAdminUser(seasonYear: string) {
    const username = process.env.REACT_APP_DEFAULT_ADMIN_USERNAME!;
    const password = process.env.REACT_APP_DEFAULT_ADMIN_PASSWORD!;
    const teamNumber = process.env.REACT_APP_DEFAULT_ADMIN_TEAM_NUMBER!;
    const teamName = process.env.REACT_APP_DEFAULT_ADMIN_TEAM_NAME!;
    const tags = [UserTags.TEAM, UserTags.ADMIN];

    const user = { username, password, teamNumber, teamName, tags };
    await setDoc(doc(firestore, 'seasons', seasonYear, 'users', username), userToFirebase(user));
}

async function createDefaultScoutingTeams(seasonYear: string) {
    const defaultTeamNumber = process.env.REACT_APP_DEFAULT_ADMIN_TEAM_NUMBER!;
    const defaultTeamName = process.env.REACT_APP_DEFAULT_ADMIN_TEAM_NAME!;

    await setDoc(doc(firestore, 'seasons', seasonYear, 'scouting-teams', defaultTeamNumber), { name: defaultTeamName });
}