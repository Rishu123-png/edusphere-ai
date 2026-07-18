"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinSchool = exports.createSchool = void 0;
const app_1 = require("firebase-admin/app");
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, database_1.getDatabase)();
const codePattern = /^EDU-[A-Z0-9]{6,12}$/;
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const id = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
function requireUser(auth) {
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Please sign in first.');
    if (auth.token.email_verified !== true)
        throw new https_1.HttpsError('permission-denied', 'Verify your email before school setup.');
    return auth;
}
/** Server-owned role and school membership writes. Never expose these writes to a browser. */
exports.createSchool = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    const auth = requireUser(request.auth);
    const schoolName = clean(request.data?.schoolName);
    if (schoolName.length < 2)
        throw new https_1.HttpsError('invalid-argument', 'Enter a school name.');
    const schoolId = id('sch_');
    const code = `EDU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const now = Date.now();
    const email = clean(auth.token.email, 254).toLowerCase();
    const displayName = clean(request.data?.principal || auth.token.name || email.split('@')[0]);
    const school = { id: schoolId, name: schoolName, code, address: clean(request.data?.address, 250), phone: clean(request.data?.phone, 32), principal: displayName, email, createdBy: auth.uid, createdAt: now };
    const profile = { uid: auth.uid, email, displayName, role: 'school_admin', schoolId, schoolCode: code, createdAt: now, updatedAt: now, isOnline: true };
    await db.ref().update({ [`schools/${schoolId}`]: school, [`users/${auth.uid}`]: profile, [`schools/${schoolId}/teachers/${auth.uid}`]: { uid: auth.uid, email, name: displayName, role: 'school_admin', schoolId, createdAt: now } });
    return { schoolId, code };
});
exports.joinSchool = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    const auth = requireUser(request.auth);
    const code = clean(request.data?.code).toUpperCase();
    const role = request.data?.role === 'parent' ? 'parent' : 'teacher';
    if (!codePattern.test(code))
        throw new https_1.HttpsError('invalid-argument', 'Enter a valid school code.');
    const schools = await db.ref('schools').orderByChild('code').equalTo(code).limitToFirst(1).get();
    if (!schools.exists())
        throw new https_1.HttpsError('not-found', 'School code was not found.');
    const [schoolId, school] = Object.entries(schools.val())[0];
    const now = Date.now();
    const email = clean(auth.token.email, 254).toLowerCase();
    const displayName = clean(auth.token.name || email.split('@')[0]);
    let linkedStudentIds = [];
    if (role === 'parent') {
        const students = await db.ref(`schools/${schoolId}/students`).get();
        linkedStudentIds = Object.entries(students.val() || {}).filter(([, s]) => s?.parentUid === auth.uid || s?.guardianUid === auth.uid || String(s?.guardianEmail || '').toLowerCase() === email).map(([studentId]) => studentId);
        if (!linkedStudentIds.length)
            throw new https_1.HttpsError('permission-denied', 'No child is linked to this email. Ask the school to add the guardian email first.');
    }
    const profile = { uid: auth.uid, email, displayName, role, schoolId, schoolCode: school.code, ...(role === 'parent' ? { linkedStudentIds } : {}), createdAt: now, updatedAt: now, isOnline: true };
    const updates = { [`users/${auth.uid}`]: profile };
    if (role === 'teacher')
        updates[`schools/${schoolId}/teachers/${auth.uid}`] = { uid: auth.uid, email, name: displayName, role, schoolId, createdAt: now };
    await db.ref().update(updates);
    return { schoolId, schoolName: school.name, role };
});
